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
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
try:
    from .nvd_client import enrich_vulns_with_nvd
    from .scoring import ScoringInput, compute_risk_score
    from .rag_client import query_similar_cves, upsert_cve, generate_remediation, query_threats, evaluate_threat_with_llm, generate_ai_analysis
except (ImportError, ValueError):
    from nvd_client import enrich_vulns_with_nvd
    from scoring import ScoringInput, compute_risk_score
    from rag_client import query_similar_cves, upsert_cve, generate_remediation, query_threats, evaluate_threat_with_llm, generate_ai_analysis

logger = logging.getLogger(__name__)

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

# ─── CVSS v3.1 VECTOR PARSER ──────────────────────────────────────────────────

def parse_cvss_vector(vector_str: str) -> float:
    """
    Parse a CVSS score from either a plain float string ("7.5") or a full
    CVSS v3.x vector string ("CVSS:3.1/AV:N/AC:L/...").
    Returns the Base Score as a float, or 0.0 on parse failure.
    """
    if not vector_str:
        return 0.0

    # Try plain float first
    try:
        return float(vector_str)
    except (ValueError, TypeError):
        pass

    # Parse CVSS v3 vector string
    try:
        if not vector_str.upper().startswith("CVSS:3"):
            logger.warning(f"Unsupported CVSS vector format: {vector_str}")
            return 0.0

        parts = vector_str.split("/")
        metrics = {}
        for part in parts:
            if ":" in part:
                key, val = part.split(":", 1)
                metrics[key.upper()] = val.upper()

        # Weight tables
        av_weights = {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.20}
        ac_weights = {"L": 0.77, "H": 0.44}
        pr_weights_unchanged = {"N": 0.85, "L": 0.62, "H": 0.27}
        pr_weights_changed   = {"N": 0.85, "L": 0.68, "H": 0.50}
        ui_weights = {"N": 0.85, "R": 0.62}
        cia_weights = {"H": 0.56, "L": 0.22, "N": 0.0}

        scope_changed = metrics.get("S") == "C"

        av = av_weights.get(metrics.get("AV", "N"), 0.85)
        ac = ac_weights.get(metrics.get("AC", "L"), 0.77)
        pr_table = pr_weights_changed if scope_changed else pr_weights_unchanged
        pr = pr_table.get(metrics.get("PR", "N"), 0.85)
        ui = ui_weights.get(metrics.get("UI", "N"), 0.85)

        c = cia_weights.get(metrics.get("C", "N"), 0.0)
        i = cia_weights.get(metrics.get("I", "N"), 0.0)
        a = cia_weights.get(metrics.get("A", "N"), 0.0)

        # ISC (Impact Sub-Score)
        isc_base = 1.0 - (1.0 - c) * (1.0 - i) * (1.0 - a)

        if scope_changed:
            isc = 7.52 * (isc_base - 0.029) - 3.25 * ((isc_base - 0.02) ** 15)
        else:
            isc = 6.42 * isc_base

        # Exploitability
        exploitability = 8.22 * av * ac * pr * ui

        if isc <= 0:
            return 0.0

        if scope_changed:
            base_score = min(1.08 * (isc + exploitability), 10.0)
        else:
            base_score = min(isc + exploitability, 10.0)

        # Round up to 1 decimal place (CVSS spec: "round up")
        return math.ceil(base_score * 10) / 10

    except Exception as e:
        logger.error(f"Failed to parse CVSS vector '{vector_str}': {e}")
        return 0.0


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
            cvss_vector = ""
            for sev_entry in v.get("severity", []):
                if sev_entry.get("type") == "CVSS_V3":
                    score_str = sev_entry.get("score", "")
                    cvss_vector = score_str
                    cvss = parse_cvss_vector(score_str)
                    if cvss > 0:
                        break
            
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

            results.append({
                "id": vid,
                "cvss": cvss,
                "cvssVector": cvss_vector,
                "severity": db_sev or _score_to_sev(cvss),
                "summary": summary,
                "url": f"https://osv.dev/vulnerability/{vid}",
            })
        return results
    except Exception:
        return []

def fetch_osv_batch(deps_list):
    """Fetch OSV data for a list of packages in parallel and store in OSV_CACHE."""
    unique_queries = []
    for d in deps_list:
        cache_key = f"{d['name']}@{d['version']}"
        if cache_key not in OSV_CACHE:
            unique_queries.append((d['name'], d['version']))
    
    if not unique_queries:
        return

    # Use a thread pool to fetch full vulnerability details in parallel.
    # OSV individual queries return full metadata; querybatch does not.
    with ThreadPoolExecutor(max_workers=40) as executor:
        future_to_key = {
            executor.submit(query_osv, name, ver): f"{name}@{ver}"
            for name, ver in unique_queries
        }
        for future in as_completed(future_to_key):
            key = future_to_key[future]
            try:
                OSV_CACHE[key] = future.result()
            except Exception as e:
                logger.error(f"Failed to fetch OSV for {key}: {e}")
                OSV_CACHE[key] = []


def _extract_license(data):
    """Extract license string from npm registry data, handling various formats."""
    # Top-level "license" field — most common
    lic = data.get("license")
    if isinstance(lic, str) and lic:
        return lic
    if isinstance(lic, dict):
        lic_type = lic.get("type", "")
        if lic_type:
            return lic_type

    # Try extracting from the latest version's metadata
    latest_tag = (data.get("dist-tags") or {}).get("latest", "")
    if latest_tag:
        version_data = data.get("versions", {}).get(latest_tag, {})
        lic2 = version_data.get("license")
        if isinstance(lic2, str) and lic2:
            return lic2
        if isinstance(lic2, dict):
            lic_type2 = lic2.get("type", "")
            if lic_type2:
                return lic_type2

    return "Unknown"


def query_npm_meta(name):
    """Fetch latest version, dates, license, maintainer info from npm registry."""
    if name in NPM_CACHE:
        return NPM_CACHE[name]
    try:
        r = requests.get(f"https://registry.npmjs.org/{name}", timeout=10)
        r.raise_for_status()
        data = r.json()
        latest = (data.get("dist-tags") or {}).get("latest")
        times = data.get("time") or {}
        modified = times.get("modified")
        created = times.get("created")
        
        # Versions count for 'versions_behind'
        versions = list(data.get("versions", {}).keys())
        
        res = {
            "latest": latest,
            "modified": modified,
            "created": created,
            "license": _extract_license(data),
            "description": data.get("description") or "",
            "homepage": data.get("homepage"),
            "maintainers_count": len(data.get("maintainers") or []),
            "deprecated": data.get("versions", {}).get(latest, {}).get("deprecated"),
            "versions": versions,
        }
        
        # Fetch weekly downloads from separate api.npmjs.org
        try:
            dr = requests.get(f"https://api.npmjs.org/downloads/point/last-week/{name}", timeout=5)
            if dr.status_code == 200:
                res["weekly_downloads"] = dr.json().get("downloads", 0)
            else:
                res["weekly_downloads"] = 0
        except Exception:
            res["weekly_downloads"] = 0

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
    
    meta = None
    # Smart NPM Registry Bypass: Only fetch metadata if it's a direct dependency or has vulnerabilities
    if depth == 1 or len(vulns) > 0:
        meta = query_npm_meta(name)

    # ── Compute CVSS-like score (max of individual CVEs) ──
    max_cvss = 0.0
    best_vector = ""
    if vulns:
        max_cvss = max(v["cvss"] for v in vulns)
        # Find the vector for the highest scoring vuln
        for v in vulns:
            if v["cvss"] == max_cvss:
                best_vector = v.get("cvssVector", "")
                break
                
    # RAG Threat Intelligence Pass
    threat_intel_payload = None
    threat_intel_score = 0.0
    
    # Evaluate threats ONLY for vulnerable packages to save time
    if vulns:
        threat_records = query_threats(name)
        if threat_records:
            eval_result = evaluate_threat_with_llm(name, threat_records)
            if eval_result.get("is_threat"):
                threat_intel_score = 8.5 # High default for active threats
                threat_intel_payload = {
                    "reason": eval_result.get("reason"),
                    "records": threat_records
                }
    
    # Default vector if missing
    if not best_vector:
        if max_cvss >= 9: best_vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
        elif max_cvss >= 7: best_vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L"
        else: best_vector = "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N"

    # Calculate health factors
    days_since_modified = 0
    days_since_created = 0
    if meta and meta.get("modified"):
        mod_dt = datetime.fromisoformat(meta["modified"].replace("Z", "+00:00"))
        days_since_modified = (datetime.now(timezone.utc) - mod_dt).days
    if meta and meta.get("created"):
        cre_dt = datetime.fromisoformat(meta["created"].replace("Z", "+00:00"))
        days_since_created = (datetime.now(timezone.utc) - cre_dt).days

    # Breakage Risk & Versions Behind
    def get_major(v):
        v = _clean_version(v)
        parts = str(v).split('.')
        return int(parts[0]) if parts[0].isdigit() else 0

    current_major = get_major(version)
    latest_ver = meta["latest"] if meta and meta.get("latest") else version
    latest_major = get_major(latest_ver)
    is_major_behind = latest_major > current_major
    
    versions_behind = 0
    if meta and meta.get("versions"):
        try:
            # Simple count of versions released after the current one
            if version in meta["versions"]:
                idx = meta["versions"].index(version)
                versions_behind = len(meta["versions"]) - 1 - idx
            else:
                versions_behind = 1 if latest_ver != version else 0
        except Exception:
            versions_behind = 0

    # ── NEW SCORING ENGINE ──
    scoring_input = ScoringInput(
        cvss_base=max_cvss,
        cvss_vector=best_vector,
        exploit_maturity="NOT_DEFINED", # Future: extract from NVD/Advisories
        is_reachable=(usage_count > 0),
        is_direct=(depth == 1),
        depth=depth - 1,
        days_since_modified=days_since_modified,
        days_since_created=days_since_created,
        maintainer_count=meta.get("maintainers_count", 1) if meta else 1,
        weekly_downloads=meta.get("weekly_downloads", 0) if meta else 0,
        versions_behind=versions_behind,
        is_major_behind=is_major_behind,
        has_deprecation_notice=bool(meta.get("deprecated")) if meta else False,
        fix_available=(latest_ver != version),
        fix_breaks_api=is_major_behind,
        threat_intel_score=threat_intel_score,
    )
    score, sev, score_breakdown = compute_risk_score(scoring_input)

    # ── Description & RAG Remediation ──
    def clean_markdown(text):
        text = re.sub(r'#+\s*', '', text)
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        return text.strip()

    cve_ids = [v["id"] for v in vulns]
    meta_desc = (meta["description"] if meta else "") or ""
    pkg_desc = ""
    plain_desc = ""
    
    if vulns:
        v0 = vulns[0]
        pkg_desc = clean_markdown(v0["summary"])
        
        # Use Groq for AI Analysis ONLY for CRITICAL and HIGH to save time and API rate limits
        if sev in ("CRITICAL", "HIGH") and v0.get("summary"):
             plain_desc = generate_ai_analysis(name, v0["id"], v0["summary"])
        else:
             plain_desc = pkg_desc

        if "no description provided" in pkg_desc.lower() or not pkg_desc:
            pkg_desc = f"Vulnerability detected in {name}. {meta_desc}"
    elif latest_ver != version:
        pkg_desc = f"Outdated package. {meta_desc}"
    else:
        pkg_desc = f"No known vulnerabilities. {meta_desc}"

    # Generate AI Remediation for important packages only to save time
    reco_reason = ""
    if sev in ("CRITICAL", "HIGH"):
        # Async-like behavior: Upsert to Pinecone for future RAG
        for vuln in vulns:
            try:
                upsert_cve(vuln["id"], vuln.get("summary",""), vuln.get("cwes",[]), vuln["cvss"], name)
            except Exception: pass
            
        try:
            similar = query_similar_cves(pkg_desc, name)
            reco_reason = generate_remediation(name, version, cve_ids, pkg_desc, score, similar, score_breakdown)
        except Exception as e:
            reco_reason = f"AI Advisor unavailable: {str(e)}"
    else:
        # Fallback to template
        if sev != "SAFE":
            if is_major_behind:
                reco_reason = f"Upgrading major version (v{current_major} → v{latest_major}) requires careful testing. A fix command is provided below."
            else:
                reco_reason = f"Minor/patch update available. Generally safe to apply in most projects."
        else:
            if is_major_behind:
                reco_reason = f"A major update (v{latest_major}) is available. Check for breaking changes before upgrading."
            elif latest_ver != version:
                reco_reason = f"A minor update is available. Good practice to keep dependencies fresh."
            else:
                reco_reason = f"Dependency is up to date."

    # ── Final Mapping ──
    maint = "Active"
    if days_since_modified > 730: maint = "Abandoned"
    elif days_since_modified > 365: maint = "Inactive"

    # Breakage risk for UI
    breakage_risk = "LOW"
    if is_major_behind: breakage_risk = "HIGH"
    elif latest_ver != version: breakage_risk = "MEDIUM"

    # Usage info
    usage_info = "Usage data unavailable"
    if usage_count > 0: usage_info = f"Imported in {usage_count} file(s)"
    elif usage_count == 0: usage_info = "No direct imports detected"

    # NVD details
    all_cwes = []
    all_references = []
    nvd_url = ""
    published = ""
    for v in vulns:
        if v.get("cwes"): all_cwes.extend(v["cwes"])
        if v.get("references"): all_references.extend(v["references"])
        if not nvd_url and v.get("id", "").startswith("CVE-"):
            nvd_url = f"https://nvd.nist.gov/vuln/detail/{v['id']}"
        if v.get("publishedDate"):
            if not published or v["publishedDate"] < published:
                published = v["publishedDate"]

    all_cwes = list(dict.fromkeys(all_cwes))
    all_references = list(dict.fromkeys(all_references))[:3]

    # Updated date
    updated = ""
    if meta and meta.get("modified"):
        updated = meta["modified"][:10]

    # Size for graph
    sz = max(6, min(32, 8 + len(name)))

    # Fix command
    fix_cmd = ""
    if sev != "SAFE" and latest_ver != version:
        fix_cmd = f"npm install {name}@{latest_ver}"

    return {
        "id": 0, # assigned by caller
        "name": name,
        "version": version,
        "latest": latest_ver,
        "sev": sev,
        "score": score,
        "score_breakdown": score_breakdown,
        "cves": cve_ids,
        "vulns": len(vulns),
        "desc": pkg_desc,
        "plain_desc": plain_desc,
        "updated": updated,
        "maint": maint,
        "origin": origin,
        "fix": fix_cmd,
        "fixv": latest_ver,
        "alts": ALTERNATIVES.get(name, []),
        "effort": _effort(score, depth),
        "sz": sz,
        "col": SEV_COLORS.get(sev, "var(--teal)"),
        "breakage_risk": breakage_risk,
        "usage_info": usage_info,
        "reco": reco_reason,
        "cwes": all_cwes,
        "nvd_url": nvd_url,
        "published": published,
        "references": all_references,
        "threat_intel": threat_intel_payload,
        "vuln_details": vulns if vulns else []   # Pass enriched vulns (with plain_desc)
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
    
    # ── BATCH ENRICHMENT (CVE/GHSA) ──
    # Instead of enriching each dependency individually (which creates nested thread pools),
    # we collect all vulnerabilities found and enrich them in one parallel pass.
    all_discovered_vulns = []
    for cache_key in OSV_CACHE:
        all_discovered_vulns.extend(OSV_CACHE[cache_key])
    
    if all_discovered_vulns:
        enrich_vulns_with_nvd(all_discovered_vulns)
        
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
