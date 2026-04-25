import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from analyzer import scan_codebase

# Mock a manifest for Juice Shop (simplified)
manifest_content = """
{
  "dependencies": {
    "jsonwebtoken": "8.5.1",
    "lodash": "4.17.20",
    "express": "4.17.1"
  }
}
"""

results = scan_codebase("C:/Users/Shlok Dhawan/OneDrive/Desktop/DepShield", manifest_content)
print(f"Total dependencies analyzed: {len(results)}")

# App.jsx logic for final score:
# const score = results.length > 0 ? (results.reduce((acc, d) => acc + d.score, 0) / results.length) : 0;
# Then it might be multiplied by 10 to get 0-100? No, user says 39.
# Let's see the average.
avg_score = sum(d['score'] for d in results) / len(results) if results else 0
print(f"Average Risk Score (0-10): {avg_score:.2f}")
# If the user expects 39, maybe it's avg * 10 or something.
print(f"Project Health Score (expected ~39): {avg_score * 10:.1f}")
