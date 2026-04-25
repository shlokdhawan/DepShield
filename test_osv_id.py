import requests
import json
r = requests.get("https://api.osv.dev/v1/vulns/GHSA-29mw-wpgm-hmr9")
print(json.dumps(r.json(), indent=2))
