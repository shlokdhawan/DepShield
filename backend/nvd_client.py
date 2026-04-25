"""
Vulnerability Enrichment Client for DepShield.

Provides enrichment via:
  - NVD REST API v2.0 for CVE-* IDs
  - GitHub Advisory Database API for GHSA-* IDs
  - OSV.dev API for any remaining IDs

Features:
  - Thread-safe caching
  - Rate-limiting
  - Concurrent enrichment via ThreadPoolExecutor
"""

import os
import time
import threading
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from .vuln_classifier import classify_vulnerability
except (ImportError, ValueError):
    from vuln_classifier import classify_vulnerability

# ─── CONFIG ────────────────────────────────────────────────────────────────────
def get_nvd_key():
    return os.environ.get("NVD_API_KEY", "")

def get_gh_token():
    return os.environ.get("GITHUB_TOKEN", "")
NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
GHSA_API_URL = "https://api.github.com/advisories"

# ─── CACHE & SYNCHRONISATION ──────────────────────────────────────────────────
ENRICHMENT_CACHE = {}
_cache_lock = threading.Lock()

# NVD rate-limit: 50 req/s with key, 5 req/s without
_nvd_rate_limit = 50 if get_nvd_key() else 5
_nvd_semaphore = threading.Semaphore(_nvd_rate_limit)
_nvd_last_request = 0.0
_nvd_time_lock = threading.Lock()

# GitHub rate-limit: 60 req/min unauthenticated, 5000/hr with token
_gh_rate_limit = 10 if get_gh_token() else 5
_gh_semaphore = threading.Semaphore(_gh_rate_limit)
_gh_last_request = 0.0
_gh_time_lock = threading.Lock()


def _nvd_rate_wait():
    """Enforce NVD rate limits across threads."""
    global _nvd_last_request
    min_interval = 1.0 / _nvd_rate_limit
    _nvd_semaphore.acquire()
    try:
        with _nvd_time_lock:
            now = time.monotonic()
            elapsed = now - _nvd_last_request
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)
            _nvd_last_request = time.monotonic()
    finally:
        _nvd_semaphore.release()


def _gh_rate_wait():
    """Enforce GitHub API rate limits across threads."""
    global _gh_last_request
    min_interval = 1.0 / _gh_rate_limit
    _gh_semaphore.acquire()
    try:
        with _gh_time_lock:
            now = time.monotonic()
            elapsed = now - _gh_last_request
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)
            _gh_last_request = time.monotonic()
    finally:
        _gh_semaphore.release()


# ─── GITHUB ADVISORY DATABASE (GHSA) ──────────────────────────────────────────

def query_ghsa(ghsa_id: str) -> dict:
    """
    Query the GitHub Advisory Database API for a GHSA advisory.
    GET https://api.github.com/advisories/{ghsa_id}

    Returns a structured dict with:
      cvssScore, cvssVector, severity, description, cwes,
      references, publishedDate, cveId
    Returns empty dict on failure.
    """
    with _cache_lock:
        if ghsa_id in ENRICHMENT_CACHE:
            return ENRICHMENT_CACHE[ghsa_id]

    _gh_rate_wait()

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = get_gh_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        r = requests.get(
            f"{GHSA_API_URL}/{ghsa_id}",
            headers=headers,
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        # CVSS score and vector
        cvss_score = data.get("cvss", {}).get("score")
        cvss_vector = data.get("cvss", {}).get("vector_string")

        # Severity
        severity = (data.get("severity") or "").upper()

        # Description
        description = data.get("description") or data.get("summary") or ""

        # CWEs
        cwes = []
        for cwe_entry in data.get("cwes", []):
            cwe_id = cwe_entry.get("cwe_id", "")
            if cwe_id:
                cwes.append(cwe_id)

        # References
        references = []
        for ref in data.get("references", []):
            if isinstance(ref, str):
                references.append(ref)
            elif isinstance(ref, dict) and ref.get("url"):
                references.append(ref["url"])

        # Dates
        published_date = data.get("published_at") or data.get("github_reviewed_at") or ""

        # Related CVE ID (GHSA advisories often link to a CVE)
        cve_id = data.get("cve_id") or ""

        result = {
            "cvssScore": cvss_score,
            "cvssVector": cvss_vector,
            "severity": severity,
            "description": description,
            "cwes": cwes,
            "references": references,
            "publishedDate": published_date,
            "cveId": cve_id,
        }

        with _cache_lock:
            ENRICHMENT_CACHE[ghsa_id] = result

        return result

    except Exception as e:
        print(f"[DepShield] GHSA query failed for {ghsa_id}: {e}")
        result = {}
        with _cache_lock:
            ENRICHMENT_CACHE[ghsa_id] = result
        return result


# ─── OSV.dev DETAIL LOOKUP ─────────────────────────────────────────────────────

def query_osv_detail(vuln_id: str) -> dict:
    """
    Query OSV.dev for detailed info about a specific vulnerability ID.
    GET https://api.osv.dev/v1/vulns/{id}

    This works for ANY OSV ID (GHSA, CVE, PYSEC, etc.) and returns
    CVSS vector strings from the severity field.
    """
    with _cache_lock:
        if vuln_id in ENRICHMENT_CACHE:
            return ENRICHMENT_CACHE[vuln_id]

    try:
        r = requests.get(
            f"https://api.osv.dev/v1/vulns/{vuln_id}",
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        # Extract CVSS from severity entries
        cvss_score = None
        cvss_vector = None
        for sev_entry in data.get("severity", []):
            if sev_entry.get("type") == "CVSS_V3":
                cvss_vector = sev_entry.get("score", "")
                # The "score" field in OSV is actually the vector string
                # We'll need to parse it later
                break

        severity = (data.get("database_specific", {}).get("severity") or "").upper()
        description = data.get("summary") or data.get("details") or ""

        # Get related aliases (CVE IDs)
        aliases = data.get("aliases", [])
        cve_id = ""
        for alias in aliases:
            if alias.startswith("CVE-"):
                cve_id = alias
                break

        # References
        references = [ref.get("url", "") for ref in data.get("references", []) if ref.get("url")]

        # Published date
        published_date = data.get("published") or ""

        result = {
            "cvssScore": cvss_score,
            "cvssVector": cvss_vector,
            "severity": severity,
            "description": description,
            "cwes": [],
            "references": references,
            "publishedDate": published_date,
            "cveId": cve_id,
        }

        with _cache_lock:
            ENRICHMENT_CACHE[vuln_id] = result

        return result

    except Exception as e:
        print(f"[DepShield] OSV detail query failed for {vuln_id}: {e}")
        result = {}
        with _cache_lock:
            ENRICHMENT_CACHE[vuln_id] = result
        return result


# ─── NVD (CVE) QUERIES ─────────────────────────────────────────────────────────

def query_nvd(cve_id: str) -> dict:
    """
    Query the NVD REST API for a single CVE.

    Returns a structured dict with:
      cvssScore, cvssVector, severity, description, cwes,
      references, publishedDate, lastModified
    Returns empty dict on failure.
    """
    with _cache_lock:
        if cve_id in ENRICHMENT_CACHE:
            return ENRICHMENT_CACHE[cve_id]

    _nvd_rate_wait()

    headers = {}
    key = get_nvd_key()
    if key:
        headers["apiKey"] = key

    try:
        r = requests.get(
            NVD_BASE_URL,
            params={"cveId": cve_id},
            headers=headers,
            timeout=10,
        )
        r.raise_for_status()
        data = r.json()

        vulns_list = data.get("vulnerabilities", [])
        if not vulns_list:
            result = {}
            with _cache_lock:
                ENRICHMENT_CACHE[cve_id] = result
            return result

        cve_data = vulns_list[0].get("cve", {})
        metrics = cve_data.get("metrics", {})

        # Extract CVSS score: prefer v3.1 > v3.0 > v2
        cvss_score = None
        cvss_vector = None
        severity = None

        for metric_key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
            metric_list = metrics.get(metric_key, [])
            if metric_list:
                cvss_data = metric_list[0].get("cvssData", {})
                cvss_score = cvss_data.get("baseScore")
                cvss_vector = cvss_data.get("vectorString")
                severity = metric_list[0].get("baseSeverity") or cvss_data.get("baseSeverity")
                if cvss_score is not None:
                    break

        # Description (English)
        description = ""
        for desc_entry in cve_data.get("descriptions", []):
            if desc_entry.get("lang") == "en":
                description = desc_entry.get("value", "")
                break

        # CWEs
        cwes = []
        for weakness in cve_data.get("weaknesses", []):
            for desc in weakness.get("description", []):
                val = desc.get("value", "")
                if val and val != "NVD-CWE-Other" and val != "NVD-CWE-noinfo":
                    cwes.append(val)

        # References
        references = [ref.get("url", "") for ref in cve_data.get("references", []) if ref.get("url")]

        # Dates
        published_date = cve_data.get("published", "")
        last_modified = cve_data.get("lastModified", "")

        result = {
            "cvssScore": cvss_score,
            "cvssVector": cvss_vector,
            "severity": (severity or "").upper(),
            "description": description,
            "cwes": cwes,
            "references": references,
            "publishedDate": published_date,
            "lastModified": last_modified,
        }

        with _cache_lock:
            ENRICHMENT_CACHE[cve_id] = result

        return result

    except Exception as e:
        print(f"[DepShield] NVD query failed for {cve_id}: {e}")
        result = {}
        with _cache_lock:
            ENRICHMENT_CACHE[cve_id] = result
        return result


# ─── UNIFIED ENRICHMENT ────────────────────────────────────────────────────────

def _enrich_single(index_vuln):
    """
    Fetch enrichment data for a single vulnerability.
    Routes to the correct API based on the ID prefix:
      - CVE-*  → NVD API
      - GHSA-* → GitHub Advisory API (fallback: OSV detail)
      - Other  → OSV detail API
    """
    idx, vuln = index_vuln
    vuln_id = vuln.get("id", "")

    if vuln_id.startswith("CVE-"):
        return idx, query_nvd(vuln_id)
    elif vuln_id.startswith("GHSA-"):
        # Try GitHub Advisory API first
        result = query_ghsa(vuln_id)
        if result and result.get("cvssScore") is not None:
            return idx, result
        # Fallback: try OSV detail to get CVSS vector
        osv_result = query_osv_detail(vuln_id)
        if osv_result:
            # If GHSA gave us partial data, merge
            if result:
                for key in ("description", "cwes", "references", "publishedDate"):
                    if not result.get(key) and osv_result.get(key):
                        result[key] = osv_result[key]
                # If GHSA had no score but OSV has a vector, use it
                if result.get("cvssScore") is None and osv_result.get("cvssVector"):
                    result["cvssVector"] = osv_result["cvssVector"]
                return idx, result
            return idx, osv_result
        return idx, result or {}
    else:
        return idx, {}


def enrich_vulns_with_nvd(vulns: list) -> list:
    """
    Enrich a list of OSV vulnerability dicts with external data.

    For CVE-* IDs:  queries NVD API for CVSS scores, descriptions, CWEs
    For GHSA-* IDs: queries GitHub Advisory Database for CVSS scores
    
    Merges:
      - cvss score (overrides OSV heuristic if real score found)
      - severity from authoritative source
      - CWE list
      - English description (if longer/better)
      - references, publishedDate
    """
    if not vulns:
        return vulns

    # Identify vulns that need enrichment (CVE-* or GHSA-*)
    enrichable = [
        (i, v) for i, v in enumerate(vulns)
        if v.get("id", "").startswith("CVE-") or v.get("id", "").startswith("GHSA-")
    ]
    if not enrichable:
        return vulns

    t0 = time.time()

    # Import parse_cvss_vector for GHSA vector parsing
    try:
        from .analyzer import parse_cvss_vector
    except (ImportError, ValueError):
        from analyzer import parse_cvss_vector

    # Concurrent enrichment
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_enrich_single, iv): iv for iv in enrichable}
        for future in as_completed(futures):
            try:
                idx, enrich_data = future.result()
                if not enrich_data:
                    continue

                vuln = vulns[idx]

                # Override CVSS score if enrichment source has one
                if enrich_data.get("cvssScore") is not None:
                    vuln["cvss"] = float(enrich_data["cvssScore"])
                elif enrich_data.get("cvssVector"):
                    # Parse CVSS vector string to get a numeric score
                    vector = enrich_data["cvssVector"]
                    vuln["cvssVector"] = vector
                    parsed = parse_cvss_vector(vector)
                    if parsed > 0:
                        vuln["cvss"] = parsed

                # Override severity if enrichment source has one
                if enrich_data.get("severity"):
                    vuln["severity"] = enrich_data["severity"]

                # Replace summary if enrichment description is longer/better
                enrich_desc = enrich_data.get("description", "")
                current_summary = vuln.get("summary", "")
                if enrich_desc and (
                    len(enrich_desc) > len(current_summary)
                    or "no description provided" in current_summary.lower()
                ):
                    vuln["summary"] = enrich_desc

                # Append CWE list
                if enrich_data.get("cwes"):
                    vuln["cwes"] = enrich_data["cwes"]

                # Add references
                if enrich_data.get("references"):
                    vuln["references"] = enrich_data["references"]

                # Add dates
                if enrich_data.get("publishedDate"):
                    vuln["publishedDate"] = enrich_data["publishedDate"]

                # Track linked CVE ID for GHSA advisories
                if enrich_data.get("cveId"):
                    vuln["linked_cve"] = enrich_data["cveId"]

                # Task: AI-powered zero-shot classification
                if vuln.get("summary") and not vuln.get("attack_type"):
                    classification = classify_vulnerability(
                        vuln.get("id", ""),
                        vuln.get("summary", "")
                    )
                    vuln.update(classification)

            except Exception as e:
                print(f"[DepShield] Enrichment error: {e}")

    t1 = time.time()
    cve_count = sum(1 for _, v in enrichable if v.get("id", "").startswith("CVE-"))
    ghsa_count = sum(1 for _, v in enrichable if v.get("id", "").startswith("GHSA-"))
    print(f"[DepShield Timing] Enrichment: {t1 - t0:.2f}s for {cve_count} CVEs + {ghsa_count} GHSAs")

    return vulns
