import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from analyzer import query_osv

vulns = query_osv("lodash", "4.17.20")
print(json.dumps(vulns, indent=2))
