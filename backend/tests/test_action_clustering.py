import unittest
from backend.action_clustering import perform_clustering

class TestActionClustering(unittest.TestCase):

    def test_rule_fallback_small_project(self):
        dependencies = [
            {"name": "a", "R": 0.8, "has_critical_cve": False},
            {"name": "b", "R": 0.5, "M": 0.9, "has_critical_cve": False},
            {"name": "c", "R": 0.5, "M": 0.1, "has_critical_cve": False},
            {"name": "d", "R": 0.2, "has_critical_cve": False}
        ]
        perform_clustering(dependencies)
        
        self.assertEqual(dependencies[0]["clustering_method"], "rule_fallback")
        self.assertEqual(dependencies[0]["cluster_label"], "Fix This Week")
        self.assertEqual(dependencies[1]["cluster_label"], "Replace") # R=0.5, M=0.9
        self.assertEqual(dependencies[2]["cluster_label"], "Monitor") # R=0.5, M=0.1
        self.assertEqual(dependencies[3]["cluster_label"], "Safe")

    def test_safety_override(self):
        # Even if rule fallback applies
        dependencies = [
            {"name": "a", "R": 0.2, "has_critical_cve": True}
        ]
        perform_clustering(dependencies)
        self.assertEqual(dependencies[0]["cluster_label"], "Fix This Week")
        self.assertTrue(dependencies[0]["override_applied"])
        
    def test_kmeans_clustering(self):
        # We need at least 8 elements for k-means
        dependencies = [
            # Cluster 1: High V, high R
            {"name": "a1", "V": 0.9, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.9, "has_critical_cve": False},
            {"name": "a2", "V": 0.9, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.85, "has_critical_cve": False},
            
            # Cluster 2: Med R, High O/M
            {"name": "b1", "V": 0.1, "O": 0.9, "U": 0.1, "D": 0.1, "M": 0.9, "R": 0.6, "has_critical_cve": False},
            {"name": "b2", "V": 0.1, "O": 0.8, "U": 0.1, "D": 0.1, "M": 0.9, "R": 0.55, "has_critical_cve": False},
            
            # Cluster 3: Med R, Low O/M
            {"name": "c1", "V": 0.6, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.5, "has_critical_cve": False},
            {"name": "c2", "V": 0.5, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.45, "has_critical_cve": False},
            
            # Cluster 4: Low R
            {"name": "d1", "V": 0.1, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.1, "has_critical_cve": False},
            {"name": "d2", "V": 0.1, "O": 0.1, "U": 0.1, "D": 0.1, "M": 0.1, "R": 0.15, "has_critical_cve": False},
        ]
        
        perform_clustering(dependencies)
        
        # Check that method is kmeans
        self.assertEqual(dependencies[0]["clustering_method"], "kmeans")
        
        # The exact labels can be verified via mean R ranking.
        # High R (a1, a2) -> Fix This Week
        self.assertEqual(dependencies[0]["cluster_label"], "Fix This Week")
        # Low R (d1, d2) -> Safe
        self.assertEqual(dependencies[6]["cluster_label"], "Safe")
        
        # Test override on k-means
        dependencies_override = dependencies.copy()
        # Make one of the safe ones critical
        dependencies_override[6]["has_critical_cve"] = True
        
        perform_clustering(dependencies_override)
        self.assertEqual(dependencies_override[6]["cluster_label"], "Fix This Week")
        self.assertTrue(dependencies_override[6]["override_applied"])

if __name__ == '__main__':
    unittest.main()
