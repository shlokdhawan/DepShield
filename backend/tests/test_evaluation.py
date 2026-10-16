"""Controlled fixtures test tooling; they are not empirical project results."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from backend.scripts.evaluation_data import load_features
from backend.scripts.evaluate_clustering import evaluate
from backend.scripts.compare_baselines import compare, npm_high, snyk_high
from backend.scripts.generate_report_json import capture_tool, snapshot


class TestFeatureEvidence(unittest.TestCase):
    def test_missing_data_and_missing_factors_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "not found"):
                load_features(Path(directory) / "missing.json")
            path = Path(directory) / "data.json"
            path.write_text(json.dumps([{"name": "a", "V": 0}]))
            with self.assertRaisesRegex(ValueError, "missing/invalid O"):
                load_features(path)

    def test_exported_report_and_raw_scan_are_equivalent(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory) / "raw.json"
            exported = Path(directory) / "export.json"
            values = dict(zip("VOUDM", [0, .2, .3, .4, .5]))
            raw.write_text(json.dumps([{"name": "a", "version": "1", **values, "R": .2}]))
            exported.write_text(json.dumps({"dependencies": [{"package_name": "a@1", **{f"factor_{k}": v for k, v in values.items()}, "composite_risk_R": .2}]}))
            a, _ = load_features(raw)
            b, _ = load_features(exported)
            self.assertEqual(a[0]["features"], b[0]["features"])
            self.assertEqual(a[0]["R"], b[0]["R"])
            self.assertEqual(a[0]["features"][0], 0)  # Measured zero is valid.
            values["U"] = float("nan")
            raw.write_text(json.dumps([values]))
            with self.assertRaisesRegex(ValueError, "finite"):
                load_features(raw)

    def test_real_comparison_outputs_and_equation_audit(self):
        # Three clearly separated fixture groups, each with four distinct rows.
        deps = [{"name": f"p{g}-{i}", "version": "1", "V": g * .4 + i * .001,
                 "O": g * .4, "U": .1, "D": .1, "M": .1, "R": .9}
                for g in range(3) for i in range(4)]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "fixture.json"
            source.write_text(json.dumps(deps))
            output = Path(directory) / "out"
            result = evaluate(source, output, seeds=(42, 7))
            self.assertEqual(result["best_k_by_mean_silhouette"], 3)
            self.assertEqual(len(result["runs"]), 14)
            self.assertEqual(sum(r["count"] for r in result["k3_k4_cross_tab"]), 12)
            for k in (3, 4):
                clusters = [r for r in result["centroids"] if r["k"] == k and r["seed"] == 42]
                self.assertEqual(len(clusters), k)
                self.assertEqual(sum(r["size"] for r in clusters), 12)
            self.assertGreater(result["paper_equation_audit"]["max_absolute_difference"], .1)
            self.assertTrue((output / "cluster_diagnostics.png").read_bytes().startswith(b"\x89PNG"))
            self.assertIn("sha256", result["sources"][0])

    def test_degenerate_dataset_cannot_claim_four_clusters(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "data.json"
            source.write_text(json.dumps([dict.fromkeys("VOUDM", 0)] * 10))
            with self.assertRaisesRegex(ValueError, "distinct"):
                evaluate(source, Path(directory) / "out")


class TestBaselines(unittest.TestCase):
    def capture(self):
        return {"schema_version": 1, "scope": "all_dependencies_manifest_only",
                "repository": {"commit": "a" * 40, "lock_sha256": "hash", "path": "repo", "sample_type": "training"},
                "results": [{"name": "a", "sev": "HIGH", "vulns": 0},
                            {"name": "b", "sev": "MEDIUM", "vulns": 1, "vuln_details": [{"severity": "HIGH"}]},
                            {"name": "b", "sev": "MEDIUM", "vulns": 1, "vuln_details": [{"severity": "HIGH"}]}],
                "npm_audit": {"status": "complete", "data": {"vulnerabilities": {"b": {"severity": "high"}}}}}

    def test_composite_is_not_advisory_and_duplicates_are_aggregated(self):
        rows = compare(self.capture())
        self.assertEqual(rows[0]["depshield_only"], ["a"])
        self.assertEqual(rows[0]["baseline_only"], ["b"])
        self.assertEqual(rows[1]["shared"], 1)
        self.assertEqual(rows[1]["depshield_packages"], 1)
        self.assertNotIn("precision", rows[1])

    def test_missing_baseline_is_not_zero(self):
        capture = self.capture()
        del capture["npm_audit"]
        with self.assertRaisesRegex(ValueError, "not captured"):
            compare(capture)
        with self.assertRaises(ValueError):
            npm_high({"error": {"code": "network"}})
        with self.assertRaises(ValueError):
            snyk_high({"ok": False, "error": "authentication failed"})

    def test_mismatched_scope_and_failed_baseline_are_rejected(self):
        capture = self.capture()
        capture["scope"] = "production_only"
        with self.assertRaisesRegex(ValueError, "scope"):
            compare(capture)
        capture = self.capture()
        capture["npm_audit"]["status"] = "failed"
        with self.assertRaisesRegex(ValueError, "successfully"):
            compare(capture)

    def test_exit_one_can_be_success_but_bad_json_cannot(self):
        version = SimpleNamespace(returncode=0, stdout="11.0", stderr="")
        finding = SimpleNamespace(returncode=1, stdout='{"vulnerabilities":{"a":{"severity":"high"}}}', stderr="")
        with patch("backend.scripts.generate_report_json.run", side_effect=[version, finding]):
            result = capture_tool("npm", ["audit", "--json"], ".", npm_high)
        self.assertEqual(result["status"], "complete")
        finding.stdout = "not JSON"
        with patch("backend.scripts.generate_report_json.run", side_effect=[version, finding]):
            result = capture_tool("npm", ["audit", "--json"], ".", npm_high)
        self.assertEqual(result["status"], "failed")

    def test_snapshot_rejects_wrong_commit_and_dirty_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch("backend.scripts.generate_report_json.git_value", return_value="a" * 40):
                with self.assertRaisesRegex(ValueError, "checkout"):
                    snapshot(directory, "b" * 40, "git", "production")
            with patch("backend.scripts.generate_report_json.git_value", side_effect=["a" * 40, " M package.json"]):
                with self.assertRaisesRegex(ValueError, "clean"):
                    snapshot(directory, "a" * 40, "git", "production")


if __name__ == "__main__":
    unittest.main()
