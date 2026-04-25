import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from analyzer import fetch_osv_batch, OSV_CACHE

fetch_osv_batch([{"name": "lodash", "version": "4.17.20"}])
vulns = OSV_CACHE.get("lodash@4.17.20", [])
print("Batch Lodash 4.17.20 vulnerabilities:", len(vulns))
if vulns:
    print("Highest CVSS:", max(v["cvss"] for v in vulns))
    print("Severities:", [v["severity"] for v in vulns])
