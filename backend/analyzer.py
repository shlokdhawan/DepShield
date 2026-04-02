"""
DepShield Analyzer — Real dependency scanning engine.

Pipeline:
  1. Parse manifest (package.json or package-lock.json)
  2. Query OSV API for vulnerability data  
  3. Query npm registry for package metadata
  4. Calculate risk scores, classify severity
  5. Build origin traces
  6. Generate fix recommendations
  7. Return data in the exact format the frontend DEPS expects
"""

import requests
import time
import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

# ─── CONSTANTS ─────────────────────────────────────────────────────────────────
CONCURRENCY = 50
ONE_YEAR_SECS = 365 * 24 * 60 * 60

# Metadata caches to prevent redundant external API calls
OSV_CACHE = {}
NPM_CACHE = {}

SEV_COLORS = {
    "CRITICAL": "var(--red)",
    "HIGH":     "var(--orange)",
    "MEDIUM":   "var(--yellow)",
    "LOW":      "var(--amber)",
    "SAFE":     "var(--teal)",
}

# Known safe-alternative suggestions
ALTERNATIVES = {
    "lodash":              [{"name": "lodash-es", "cmd": "npm install lodash-es"}],
    "moment":              [{"name": "dayjs", "cmd": "npm install dayjs"}, {"name": "date-fns", "cmd": "npm install date-fns"}],
    "request":             [{"name": "axios", "cmd": "npm install axios"}, {"name": "node-fetch", "cmd": "npm install node-fetch"}],
    "underscore":          [{"name": "lodash-es", "cmd": "npm install lodash-es"}],
    "node-uuid":           [{"name": "uuid", "cmd": "npm install uuid"}],
    "minimist":            [{"name": "yargs", "cmd": "npm install yargs"}],
    "colors":              [{"name": "chalk", "cmd": "npm install chalk"}],
    "serialize-javascript":[{"name": "json-stringify-safe", "cmd": "npm install json-stringify-safe"}],
    "handlebars":          [{"name": "mustache", "cmd": "npm install mustache"}, {"name": "eta", "cmd": "npm install eta"}],
    "marked":              [{"name": "remark", "cmd": "npm install remark"}],
}

# ─── HELPERS ───────────────────────────────────────────────────────────────────

def _time_ago(date_str):
    """Convert ISO date string to human-readable 'X ago' format."""
    if not date_str:
        return "unknown"
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        seconds = (datetime.now(timezone.utc) - dt).total_seconds()
        if seconds < 0:
            return "today"
        years = seconds / 31536000
        if years > 1:
            return f"{int(years)} years ago"
        months = seconds / 2592000
        if months > 1:
            return f"{int(months)} months ago"
        days = seconds / 86400
        if days > 1:
            return f"{int(days)} days ago"
        return "today"
    except Exception:
        return "unknown"


def _clean_version(v):
    """Strip semver prefixes like ^, ~, >= etc."""
    return re.sub(r"[\^~>=<*\s]", "", str(v)).split(" ")[0] or "0.0.0"


def _score_to_sev(score):
    """Map CVSS-like score (0-10) to severity string."""
    if score >= 8:
        return "CRITICAL"
    if score >= 6:
        return "HIGH"
    if score >= 4:
        return "MEDIUM"
    if score >= 2:
        return "LOW"
    return "SAFE"


def _effort(score, depth):
    if depth > 2 or score >= 8:
        return "Hard"
    if depth > 1 or score >= 5:
        return "Medium"
    return "Easy"


# ─── API QUERIES ───────────────────────────────────────────────────────────────

def query_osv(name, version):
    """Query the OSV vulnerability database for a specific package@version."""
    try:
        r = requests.post(
            "https://api.osv.dev/v1/query",
            json={"version": version, "package": {"name": name, "ecosystem": "npm"}},
            timeout=10,
        )
        r.raise_for_status()
        vulns = r.json().get("vulns", [])
        results = []
        for v in vulns:
            vid = v.get("id", "")
            # Try to extract CVSS score from severity
            cvss = 0.0
            for sev_entry in v.get("severity", []):
                if sev_entry.get("type") == "CVSS_V3":
                    score_str = sev_entry.get("score", "")
                    # CVSS vector string — extract base score
                    # Sometimes it's just a number, sometimes a vector
                    try:
                        cvss = float(score_str)
                    except (ValueError, TypeError):
                        # Try to parse from vector
                        pass
            
            # Fallback: derive from database_specific severity
            db_sev = (v.get("database_specific", {}).get("severity", "") or "").upper()
            if cvss == 0.0:
                if db_sev == "CRITICAL":
                    cvss = 9.0
                elif db_sev == "HIGH":
                    cvss = 7.5
                elif db_sev == "MODERATE" or db_sev == "MEDIUM":
                    cvss = 5.5
                elif db_sev == "LOW":
                    cvss = 3.0
                else:
                    cvss = 5.0

            summary = v.get("summary") or v.get("details") or ""
            # If empty, we'll mark it to be filled by analyze_single
            if not summary:
                summary = "Vulnerability detected (no description provided by database)."
            # Truncate long descriptions
            if len(summary) > 200:
                summary = summary[:197] + "..."

            results.append({
                "id": vid,
                "cvss": cvss,
                "severity": db_sev or _score_to_sev(cvss),
                "summary": summary,
                "url": f"https://osv.dev/vulnerability/{vid}",
            })
        return results
    except Exception:
        return []

def fetch_osv_batch(deps_list):
    """Fetch OSV data for a list of packages in bulk and store in OSV_CACHE."""
    CHUNK_SIZE = 1000
    queries = []
    keys = []
    
    for d in deps_list:
        name = d["name"]
        version = d["version"]
        cache_key = f"{name}@{version}"
        if cache_key not in OSV_CACHE:
            queries.append({"package": {"name": name, "ecosystem": "npm"}, "version": version})
            keys.append(cache_key)

    for i in range(0, len(queries), CHUNK_SIZE):
        chunk = queries[i:i + CHUNK_SIZE]
        chunk_keys = keys[i:i + CHUNK_SIZE]
        try:
            r = requests.post("https://api.osv.dev/v1/querybatch", json={"queries": chunk}, timeout=15)
            r.raise_for_status()
            results = r.json().get("results", [])
            for j, res in enumerate(results):
                vulns = res.get("vulns", [])
                parsed_vulns = []
                for v in vulns:
                    vid = v.get("id", "")
                    cvss = 0.0
                    for sev_entry in v.get("severity", []):
                        if sev_entry.get("type") == "CVSS_V3":
                            try: cvss = float(sev_entry.get("score", ""))
                            except: pass
                    db_sev = (v.get("database_specific", {}).get("severity", "") or "").upper()
                    if cvss == 0.0:
                        if db_sev == "CRITICAL": cvss = 9.0
                        elif db_sev == "HIGH": cvss = 7.5
                        elif db_sev in ["MODERATE", "MEDIUM"]: cvss = 5.5
                        elif db_sev == "LOW": cvss = 3.0
                        else: cvss = 5.0
                    summary = v.get("summary") or v.get("details") or ""
                    if not summary:
                        summary = "Vulnerability detected (no description provided by database)."
                    if len(summary) > 200: summary = summary[:197] + "..."
                    parsed_vulns.append({
                        "id": vid, "cvss": cvss, "severity": db_sev or _score_to_sev(cvss),
                        "summary": summary, "url": f"https://osv.dev/vulnerability/{vid}"
                    })
                OSV_CACHE[chunk_keys[j]] = parsed_vulns
        except Exception as e:
            print(f"[DepShield] OSV Batch query failed: {e}")
            for k in chunk_keys:
                OSV_CACHE[k] = []


def query_npm_meta(name):
    """Fetch latest version, dates, license, maintainer info from npm registry."""
    if name in NPM_CACHE:
        return NPM_CACHE[name]
    try:
        r = requests.get(f"https://registry.npmjs.org/{name}", timeout=10)
        r.raise_for_status()
        data = r.json()
        latest = (data.get("dist-tags") or {}).get("latest")
        modified = (data.get("time") or {}).get("modified")
        res = {
            "latest": latest,
            "modified": modified,
            "license": data.get("license") or "Unknown",
            "description": data.get("description") or "",
            "homepage": data.get("homepage"),
            "maintainers": len(data.get("maintainers") or []),
        }
        NPM_CACHE[name] = res
        return res
    except Exception:
        return None


# ─── CORE ANALYZER ─────────────────────────────────────────────────────────────

def _analyze_single(dep_info):
    """Analyze a single dependency: query OSV + npm, compute scores."""
    name = dep_info["name"]
    version = dep_info["version"]
    depth = dep_info.get("depth", 1)
    origin = dep_info.get("origin", [name])
    project_type = dep_info.get("project_type", "Node.js (General)")
    usage_count = dep_info.get("usage_count", -1)

    vulns = OSV_CACHE.get(f"{name}@{version}", [])
    meta = query_npm_meta(name)

    # ── Compute CVSS-like score (max of individual CVEs) ──
    max_cvss = 0.0
    if vulns:
        max_cvss = max(v["cvss"] for v in vulns)

    # Adjust score based on other factors
    score = max_cvss

    # Bump for outdated
    is_outdated = False
    if meta and meta["latest"] and meta["latest"] != version:
        is_outdated = True
        if score < 2:
            score = max(score, 1.0)  # At minimum flag it

    # Determine maintainer status
    maint = "Active"
    if meta and meta["modified"]:
        try:
            mod_dt = datetime.fromisoformat(meta["modified"].replace("Z", "+00:00"))
            age_secs = (datetime.now(timezone.utc) - mod_dt).total_seconds()
            if age_secs > ONE_YEAR_SECS * 3:
                maint = "Abandoned"
                score = max(score, 2.5)
            elif age_secs > ONE_YEAR_SECS:
                maint = "Inactive"
        except Exception:
            pass
    if not meta:
        maint = "Inactive"

    # Transitive vs Direct weighting
    if depth > 1:
        score = score * 0.8

    # Final clamp
    score = round(min(10.0, float(score)), 1)
    sev = _score_to_sev(score)

    # ── Breakage Risk ──
    breakage_risk = "LOW"
    def get_major(v):
        v = _clean_version(v)
        parts = str(v).split('.')
        return int(parts[0]) if parts[0].isdigit() else 0

    current_major = get_major(version)
    latest_major = get_major(meta["latest"]) if meta and meta.get("latest") else current_major
    
    if latest_major > current_major:
        breakage_risk = "HIGH"
    elif is_outdated:
        breakage_risk = "MEDIUM"

    # Codebase Context Recommendations
    reco_reason = ""
    if sev != "SAFE":
        if breakage_risk == "HIGH":
            reco_reason = f"Upgrading major version (v{current_major} → v{latest_major}) requires careful testing in a {project_type} environment."
        else:
            reco_reason = f"Minor/patch update available. Generally safe to apply in {project_type} projects."
    else:
        if breakage_risk == "HIGH" and is_outdated:
            reco_reason = f"A major update (v{latest_major}) is available. Since this is a {project_type} app, check changelogs for breaking changes before upgrading."
        elif is_outdated:
            reco_reason = f"A minor update is available. Good practice to keep {project_type} dependencies fresh."
        else:
            reco_reason = f"Dependency is up to date."

    # Code usage info formatting
    usage_info = ""
    if usage_count > 0:
        usage_info = f"Imported in {usage_count} file(s)"
    elif usage_count == 0:
        usage_info = "No direct imports detected"
    else:
        usage_info = "Usage data unavailable"

    # CVE IDs list
    cve_ids = [v["id"] for v in vulns]

    # Description
    meta_desc = (meta["description"] if meta else "") or ""
    if vulns:
        # Use first vulnerability summary
        desc = vulns[0]["summary"]
        
        # If the summary is generic/missing, append or use package description instead
        if "no description provided" in desc.lower() or not desc:
            if meta_desc:
                desc = f"Vulnerability detected. {meta_desc}"
            else:
                desc = "Vulnerability detected (specific details unavailable)."
        
        if len(vulns) > 1:
            desc += f" (+{len(vulns)-1} more)"
    elif is_outdated:
        desc = f"Outdated package. {meta_desc}"
    else:
        desc = f"No known vulnerabilities. {meta_desc}"

    # Fix
    latest = (meta["latest"] if meta else None) or version
    fix_cmd = ""
    fixv = latest
    if sev != "SAFE" and is_outdated:
        fix_cmd = f"npm install {name}@{latest}"
    elif sev != "SAFE" and vulns:
        fix_cmd = f"npm install {name}@{latest}"

    # Alternatives
    alts = ALTERNATIVES.get(name, [])

    # Updated date
    updated = ""
    if meta and meta["modified"]:
        try:
            updated = meta["modified"][:10]
        except Exception:
            updated = _time_ago(meta["modified"])
    
    # Size for graph node (rough heuristic)
    sz = max(6, min(32, 8 + len(name)))

    return {
        "name": name,
        "version": version,
        "latest": latest,
        "sev": sev,
        "score": score,
        "cves": cve_ids,
        "vulns": len(vulns),
        "desc": desc,
        "updated": updated,
        "maint": maint,
        "origin": origin,
        "fix": fix_cmd,
        "fixv": fixv,
        "alts": alts,
        "effort": _effort(score, depth),
        "sz": sz,
        "col": SEV_COLORS.get(sev, "var(--teal)"),
        "breakage_risk": breakage_risk,
        "usage_info": usage_info,
        "reco": reco_reason,
    }


def analyze_manifest(filename, content, usage_map=None):
    """
    Analyze a parsed package.json or package-lock.json.
    Returns list of dep objects in the exact DEPS format the frontend expects.
    """
    deps_to_scan = []

    import time
    t0 = time.time()

    if isinstance(content, str):
        import json
        content = json.loads(content)

    if "packages" in content:
        # package-lock.json v2/v3
        for key, meta in content["packages"].items():
            if key == "" or "node_modules/" not in key:
                continue
            parts = key.split("node_modules/")
            name = parts[-1].rstrip("/")
            depth = key.count("node_modules/")
            version = meta.get("version", "0.0.0")
            # Build origin trace
            origin_parts = ["project"]
            for i, p in enumerate(parts[1:], 1):
                origin_parts.append(p.rstrip("/"))
            deps_to_scan.append({
                "name": name,
                "version": version,
                "depth": depth,
                "origin": origin_parts,
            })
    elif "dependencies" in content or "devDependencies" in content:
        # package.json
        all_deps = {}
        all_deps.update(content.get("dependencies", {}))
        all_deps.update(content.get("devDependencies", {}))
        project_name = content.get("name", "project")
        for name, version in all_deps.items():
            deps_to_scan.append({
                "name": name,
                "version": _clean_version(version),
                "depth": 1,
                "origin": [project_name, name],
            })
    else:
        raise ValueError("Unrecognized format — expected package.json or package-lock.json")

    if not deps_to_scan:
        raise ValueError("No dependencies found in file")

    # Deduplicate by name+version (keep first occurrence)
    seen = set()
    unique_deps = []
    for d in deps_to_scan:
        key = f"{d['name']}@{d['version']}"
        if key not in seen:
            seen.add(key)
            unique_deps.append(d)
    deps_to_scan = unique_deps

    # Determine Project Type
    unique_names = [d["name"] for d in deps_to_scan]
    project_type = "Node.js (General)"
    if "react" in unique_names or "next" in unique_names or "vue" in unique_names or "svelte" in unique_names:
        project_type = "Frontend (React/Vue/etc)"
    if "express" in unique_names or "koa" in unique_names or "nestjs" in unique_names or "fastify" in unique_names:
        if project_type.startswith("Frontend"):
            project_type = "Fullstack (Node + Frontend)"
        else:
            project_type = "Backend (Express/Node)"

    for d in deps_to_scan:
        d["project_type"] = project_type
        if usage_map is not None:
            d["usage_count"] = usage_map.get(d["name"], 0)
        else:
            d["usage_count"] = -1

    t1 = time.time()
    # Pre-fetch OSV vulnerabilities in batches
    fetch_osv_batch(deps_to_scan)
    t2 = time.time()

    # Parallel analysis
    results = []
    with ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        futures = {executor.submit(_analyze_single, d): d for d in deps_to_scan}
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                dep = futures[future]
                results.append({
                    "name": dep["name"],
                    "version": dep["version"],
                    "latest": dep["version"],
                    "sev": "SAFE",
                    "score": 0,
                    "cves": [],
                    "vulns": 0,
                    "desc": f"Analysis failed: {str(e)}",
                    "updated": "",
                    "maint": "Active",
                    "origin": dep.get("origin", [dep["name"]]),
                    "fix": "",
                    "fixv": dep["version"],
                    "alts": [],
                    "effort": "Easy",
                    "sz": 8,
                    "col": "var(--teal)",
                    "breakage_risk": "LOW",
                    "usage_info": "Analysis failed",
                    "reco": "Error during analysis",
                })

    # Reduce payload size for huge trees
    if len(results) > 500:
        for r in results:
            if r["sev"] == "SAFE" and len(r.get("origin", [])) > 2:
                # Strip unnecessary big fields for safe transitive deps
                r["desc"] = ""
                r["alts"] = []
                r["reco"] = ""

    # Sort: critical first, then by score descending
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "SAFE": 4}
    results.sort(key=lambda d: (sev_order.get(d["sev"], 5), -d["score"]))

    # Assign sequential IDs
    for i, r in enumerate(results):
        r["id"] = i + 1

    t3 = time.time()
    print(f"[DepShield Timing] Parse/Dedupe: {t1-t0:.2f}s | OSV Batch: {t2-t1:.2f}s | Threads/NPM: {t3-t2:.2f}s | Total Analyzer: {t3-t0:.2f}s")

    return results
