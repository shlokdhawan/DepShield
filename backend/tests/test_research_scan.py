"""No live network calls: failures must not become clean research findings."""
import unittest
from unittest.mock import Mock, patch

from backend import analyzer


class TestResearchScan(unittest.TestCase):
    def setUp(self):
        self.osv_cache = dict(analyzer.OSV_CACHE)
        self.npm_cache = dict(analyzer.NPM_CACHE)
        analyzer.OSV_CACHE.clear()
        analyzer.NPM_CACHE.clear()

    def tearDown(self):
        analyzer.OSV_CACHE.clear()
        analyzer.OSV_CACHE.update(self.osv_cache)
        analyzer.NPM_CACHE.clear()
        analyzer.NPM_CACHE.update(self.npm_cache)

    def test_missing_cvss_uses_severity_instead_of_losing_advisory(self):
        response = Mock()
        response.json.return_value = {"vulns": [{"id": "GHSA-test", "database_specific": {"severity": "HIGH"}}]}
        with patch.object(analyzer.requests, "post", return_value=response):
            results = analyzer.query_osv("package", "1", strict_errors=True)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["cvss"], 7.5)

    def test_osv_network_failure_aborts_strict_batch(self):
        with patch.object(analyzer.requests, "post", side_effect=RuntimeError("network unavailable")):
            with self.assertRaisesRegex(RuntimeError, "Incomplete OSV"):
                analyzer.fetch_osv_batch([{"name": "a", "version": "1"}], strict_errors=True)
        self.assertNotIn("a@1", analyzer.OSV_CACHE)

    def test_metadata_failure_aborts_strict_lookup(self):
        with patch.object(analyzer.requests, "get", side_effect=RuntimeError("network unavailable")):
            with self.assertRaisesRegex(RuntimeError, "npm metadata"):
                analyzer.query_npm_meta("package", strict_errors=True)
        self.assertNotIn("package", analyzer.NPM_CACHE)

    def test_strict_manifest_never_emits_safe_placeholder_for_failure(self):
        with patch.object(analyzer, "fetch_osv_batch"), patch.object(analyzer, "_analyze_single", side_effect=ValueError("bad package data")):
            with self.assertRaisesRegex(RuntimeError, "Incomplete package"):
                analyzer.analyze_manifest("package.json", {"dependencies": {"a": "1"}}, strict_errors=True)


if __name__ == "__main__":
    unittest.main()
