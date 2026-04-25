import requests
import json

q = {"version": "4.17.20", "package": {"name": "lodash", "ecosystem": "npm"}}
r = requests.post("https://api.osv.dev/v1/querybatch", json={"queries": [q]})
print("Batch:", json.dumps(r.json(), indent=2))

r2 = requests.post("https://api.osv.dev/v1/query", json=q)
print("Single:", json.dumps(r2.json(), indent=2))
