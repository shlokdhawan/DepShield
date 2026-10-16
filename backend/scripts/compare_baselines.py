"""Compare captured tool reports at package-name level, without accuracy claims."""
import argparse
import json
from pathlib import Path

try:
    from .evaluation_data import write_csv
except ImportError:
    from evaluation_data import write_csv


def depshield_sets(deps):
    composite, advisory, presence = set(), set(), set()
    for dep in deps:
        name = dep["name"]
        if "Analysis failed" in dep.get("desc", "") or dep.get("usage_info") == "Analysis failed":
            raise ValueError(f"Incomplete DepShield analysis: {name}")
        if dep.get("sev") in ("HIGH", "CRITICAL"):
            composite.add(name)
        if dep.get("vulns", 0) or dep.get("cves"):
            presence.add(name)
            details = dep.get("vuln_details")
            if not details:
                raise ValueError(f"Advisory details missing for {name}; cannot compare advisory severities")
            if any(v.get("severity", "").upper() in ("HIGH", "CRITICAL") for v in details):
                advisory.add(name)
    return composite, advisory, presence


def npm_high(data):
    if data.get("error") or not isinstance(data.get("vulnerabilities"), dict):
        raise ValueError("Expected a successful modern npm audit JSON report with vulnerabilities")
    return {name for name, finding in data["vulnerabilities"].items()
            if finding.get("severity", "").lower() in ("high", "critical")}


def snyk_high(data):
    reports = data if isinstance(data, list) else [data]
    names = set()
    for report in reports:
        if report.get("error") or not isinstance(report.get("vulnerabilities"), list):
            raise ValueError("Expected a successful Snyk JSON report with vulnerabilities")
        names.update(v["packageName"] for v in report["vulnerabilities"]
                     if v.get("severity", "").lower() in ("high", "critical"))
    return names


def compare(capture):
    if capture.get("schema_version") != 1 or capture.get("scope") != "all_dependencies_manifest_only":
        raise ValueError("Expected a version 1 capture with matching all-dependency manifest-only scope")
    repo = capture["repository"]
    if not repo.get("commit") or not repo.get("lock_sha256"):
        raise ValueError("Missing repository commit/lockfile provenance")
    composite, advisory, presence = depshield_sets(capture["results"])
    outputs = []
    for tool, extractor in (("npm_audit", npm_high), ("snyk", snyk_high)):
        saved = capture.get(tool)
        if saved is None:
            if tool == "npm_audit":
                raise ValueError("npm audit was not captured; missing is not a zero baseline")
            continue
        if saved.get("status") != "complete":
            raise ValueError(f"{tool} did not complete successfully")
        baseline = extractor(saved["data"])
        for label, selected in (("composite_high_critical", composite), ("advisory_high_critical", advisory),
                                ("any_advisory_presence", presence)):
            outputs.append({"repository": repo.get("origin") or repo["path"], "commit": repo["commit"],
                            "sample_type": repo["sample_type"], "baseline": tool, "depshield_measure": label,
                            "depshield_packages": len(selected), "baseline_high_critical_packages": len(baseline),
                            "shared": len(selected & baseline), "depshield_only": sorted(selected - baseline),
                            "baseline_only": sorted(baseline - selected),
                            "jaccard": len(selected & baseline) / len(selected | baseline) if selected | baseline else None})
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", nargs="+", help="Pinned scan capture JSON files")
    parser.add_argument("--output", default="evaluation/baselines")
    args = parser.parse_args()
    rows = []
    try:
        for path in args.captures:
            rows.extend(compare(json.loads(Path(path).read_text(encoding="utf-8"))))
    except (ValueError, KeyError, OSError) as exc:
        parser.exit(2, f"Comparison failed: {exc}\n")
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    payload = {"unit": "Unique package names; versions and repeated paths aggregated",
               "scope": "All dependencies, including devDependencies",
               "limitations": ["Agreement is not precision or recall.",
                               "Composite risk differs from advisory severity.",
                               "npm may propagate severity to parent packages through metavulnerabilities.",
                               "Tools may share advisory sources; agreement is not independent ground truth.",
                               "Any-advisory presence has a broader threshold than the High/Critical baseline."],
               "comparisons": rows}
    (output / "baseline_comparison.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    write_csv(output / "baseline_comparison.csv",
              [{**r, "depshield_only": "; ".join(r["depshield_only"]), "baseline_only": "; ".join(r["baseline_only"])} for r in rows],
              list(rows[0]) if rows else [])
    text = ["# Baseline agreement", "", payload["unit"] + ". " + payload["scope"] + ".", "",
            "| Repository | Sample type | Baseline | DepShield measure | DepShield count | Baseline high/critical | Shared |",
            "|---|---|---|---|---:|---:|---:|"]
    text += [f"| {r['repository']} | {r['sample_type']} | {r['baseline']} | {r['depshield_measure']} | {r['depshield_packages']} | {r['baseline_high_critical_packages']} | {r['shared']} |" for r in rows]
    text += ["", *[f"- {item}" for item in payload["limitations"]], "",
             "Review package disagreements in the JSON. No superiority, false-positive reduction or triage-time result is inferred."]
    (output / "baseline_report.md").write_text("\n".join(text) + "\n", encoding="utf-8")
    print(f"Saved comparisons to {output}")


if __name__ == "__main__":
    main()
