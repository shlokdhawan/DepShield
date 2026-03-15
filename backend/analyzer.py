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
CONCURRENCY = 10
ONE_YEAR_SECS = 365 * 24 * 60 * 60

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

            summary = v.get("summary") or v.get("details", "No details available.")
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


def query_npm_meta(name):
    """Fetch latest version, dates, license, maintainer info from npm registry."""
    try:
        r = requests.get(f"https://registry.npmjs.org/{name}", timeout=10)
        r.raise_for_status()
        data = r.json()
        latest = (data.get("dist-tags") or {}).get("latest")
        modified = (data.get("time") or {}).get("modified")
        return {
            "latest": latest,
            "modified": modified,
            "license": data.get("license") or "Unknown",
            "description": data.get("description") or "",
            "homepage": data.get("homepage"),
            "maintainers": len(data.get("maintainers") or []),
        }
    except Exception:
        return None


# ─── CORE ANALYZER ─────────────────────────────────────────────────────────────

def _analyze_single(dep_info):
    """Analyze a single dependency: query OSV + npm, compute scores."""
    name = dep_info["name"]
    version = dep_info["version"]
    depth = dep_info.get("depth", 1)
    origin = dep_info.get("origin", [name])

    vulns = query_osv(name, version)
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
    elif not meta:
        maint = "Inactive"

    # Final clamp
    score = round(min(10.0, score), 1)
    sev = _score_to_sev(score)

    # CVE IDs list
    cve_ids = [v["id"] for v in vulns]

    # Description
    if vulns:
        desc = vulns[0]["summary"]
        if len(vulns) > 1:
            desc += f" (+{len(vulns)-1} more)"
    elif is_outdated:
        meta_desc = (meta["description"] if meta else "") or ""
        desc = f"Outdated package. {meta_desc}"
    else:
        meta_desc = (meta["description"] if meta else "") or ""
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
    }


def analyze_manifest(filename, content):
    """
    Analyze a parsed package.json or package-lock.json.
    Returns list of dep objects in the exact DEPS format the frontend expects.
    """
    deps_to_scan = []

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

    # Deduplicate by name (keep first occurrence)
    seen = set()
    unique_deps = []
    for d in deps_to_scan:
        if d["name"] not in seen:
            seen.add(d["name"])
            unique_deps.append(d)
    deps_to_scan = unique_deps

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
                })

    # Sort: critical first, then by score descending
    sev_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "SAFE": 4}
    results.sort(key=lambda d: (sev_order.get(d["sev"], 5), -d["score"]))

    # Assign sequential IDs
    for i, r in enumerate(results):
        r["id"] = i + 1

    return results
