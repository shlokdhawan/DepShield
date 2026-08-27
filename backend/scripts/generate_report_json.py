import os
import json
import sys
import datetime
import requests

def generate_report(repo_url, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Scanning repository: {repo_url} via local API...")
    try:
        response = requests.post("http://localhost:5000/api/scan", json={"repoUrl": repo_url})
        response.raise_for_status()
        deps = response.json()
    except Exception as e:
        print(f"Failed to scan {repo_url}. Ensure the backend server is running on port 5000. Error: {e}")
        sys.exit(1)
        
    print(f"Retrieved {len(deps)} dependencies.")
    
    # 1. Compute Top-Level Variables
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    
    total_deps = len(deps)
    fallback_applied = False
    baseline_high_crit = 0
    cluster_counts = {
        "Fix This Week": 0,
        "Replace": 0,
        "Monitor": 0,
        "Safe": 0
    }
    
    # 2. Dependency-Level Data
    formatted_deps = []
    
    for d in deps:
        if d.get("clustering_method") == "rule_fallback":
            fallback_applied = True
            
        if d.get("sev") in ["HIGH", "CRITICAL"]:
            baseline_high_crit += 1
            
        label = d.get("cluster_label", "Safe")
        if label in cluster_counts:
            cluster_counts[label] += 1
            
        formatted_deps.append({
            "package_name": f"{d.get('name', 'unknown')}@{d.get('version', 'unknown')}",
            "factor_V": d.get('V', 0.0),
            "factor_O": d.get('O', 0.0),
            "factor_U": d.get('U', 0.0),
            "factor_D": d.get('D', 0.0),
            "factor_M": d.get('M', 0.0),
            "composite_risk_R": d.get('R', 0.0),
            "has_critical_cve": d.get('has_critical_cve', False),
            "override_applied": d.get('override_applied', False),
            "cluster_label": label
        })
        
    # Build final schema
    repo_name_safe = repo_url.split('/')[-1].replace('.git', '')
    if not repo_name_safe:
        repo_name_safe = "unknown_repo"
        
    report_data = {
        "repository_summary": {
            "repo_name": repo_name_safe,
            "scan_timestamp": timestamp,
            "total_dependencies": total_deps,
            "fallback_rule_applied": fallback_applied,
            "baseline_high_crit_count": baseline_high_crit,
            "cluster_distribution": cluster_counts
        },
        "dependencies": formatted_deps
    }
    
    output_path = os.path.join(output_dir, f"{repo_name_safe}_results.json")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, indent=2)
        
    print(f"Success! Data saved to {output_path}")

if __name__ == "__main__":
    url = "https://github.com/shlokdhawan/DepShield.git"
    if len(sys.argv) > 1:
        url = sys.argv[1]
        
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "paper_data"))
    generate_report(url, out_dir)
