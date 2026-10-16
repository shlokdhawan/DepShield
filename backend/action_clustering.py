"""Four operational action groups, not a statistically validated optimal k.

Compare k=3/k=4 on preserved features with scripts/evaluate_clustering.py
before changing this application policy. Research metrics must use raw
cluster_id assignments, before the critical-risk action override.
"""
import numpy as np
from sklearn.cluster import KMeans

MIN_CLUSTER_SIZE = 8

def label_clusters(centroids):
    """
    Given a list of (raw_cluster_id, centroid_vector) where centroid_vector is [V, O, U, D, M, mean_R],
    returns a dict mapping raw_cluster_id to semantic label.
    """
    # Rank by mean_R descending
    ranked = sorted(centroids, key=lambda c: c[1][5], reverse=True)
    
    labels = {}
    if len(ranked) >= 4:
        # Highest R -> Fix This Week
        labels[ranked[0][0]] = "Fix This Week"
        
        # Heuristic tiebreaker for 2nd and 3rd
        c1, c2 = ranked[1], ranked[2]
        
        score_c1 = c1[1][1] + c1[1][4] - c1[1][0]
        score_c2 = c2[1][1] + c2[1][4] - c2[1][0]
        
        if score_c2 > score_c1 and score_c2 > 0:
            labels[c2[0]] = "Replace"
            labels[c1[0]] = "Monitor"
        else:
            labels[c1[0]] = "Replace"
            labels[c2[0]] = "Monitor"
            
        # Lowest R -> Safe
        labels[ranked[3][0]] = "Safe"
    else:
        for i, c in enumerate(ranked):
            if i == 0: labels[c[0]] = "Fix This Week"
            elif i == 1: labels[c[0]] = "Replace"
            elif i == 2: labels[c[0]] = "Monitor"
            else: labels[c[0]] = "Safe"
            
    return labels


def perform_clustering(dependencies):
    """
    Cluster dependencies into Action Groups.
    Expects dependencies list with keys: 'name', 'V', 'O', 'U', 'D', 'M', 'R', 'has_critical_cve'
    Modifies dependencies in-place.
    """
    if len(dependencies) < MIN_CLUSTER_SIZE:
        for dep in dependencies:
            dep['clustering_method'] = "rule_fallback"
            dep['cluster_id'] = -1
            r = dep.get('R', 0.0)
            if r >= 0.75:
                label = "Fix This Week"
            elif r >= 0.40:
                if dep.get('M', 0.0) >= 0.8 or dep.get('O', 0.0) >= 0.8:
                    label = "Replace"
                else:
                    label = "Monitor"
            else:
                label = "Safe"
            _apply_override(dep, label)
        return

    X = []
    for dep in dependencies:
        X.append([
            dep.get('V', 0.0),
            dep.get('O', 0.0),
            dep.get('U', 0.0),
            dep.get('D', 0.0),
            dep.get('M', 0.0)
        ])
    
    X = np.array(X)
    kmeans = KMeans(n_clusters=4, n_init=10, random_state=42)
    kmeans.fit(X)
    
    centroids = []
    for i in range(4):
        indices = np.where(kmeans.labels_ == i)[0]
        if len(indices) > 0:
            cluster_X = X[indices]
            mean_R = np.mean([dependencies[idx].get('R', 0.0) for idx in indices])
            mean_vector = list(np.mean(cluster_X, axis=0)) + [mean_R]
            centroids.append((i, mean_vector))
        else:
            centroids.append((i, [0, 0, 0, 0, 0, 0]))

    labels_map = label_clusters(centroids)
    
    for idx, dep in enumerate(dependencies):
        dep['clustering_method'] = "kmeans"
        cid = int(kmeans.labels_[idx])
        dep['cluster_id'] = cid
        base_label = labels_map.get(cid, "Safe")
        _apply_override(dep, base_label)

def _apply_override(dep, base_label):
    if dep.get('has_critical_cve') and base_label != "Fix This Week":
        dep['cluster_label'] = "Fix This Week"
        dep['override_applied'] = True
    else:
        dep['cluster_label'] = base_label
        dep['override_applied'] = False
