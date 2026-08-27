import os
import json
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def load_data(data_dir):
    features = []
    if not os.path.exists(data_dir):
        print(f"Data directory {data_dir} not found. Returning dummy data for demonstration.")
        # Generate some dummy data if directory doesn't exist to prevent crash
        np.random.seed(42)
        features = np.random.rand(100, 5).tolist()
        return np.array(features)

    for filename in os.listdir(data_dir):
        if filename.endswith(".json"):
            path = os.path.join(data_dir, filename)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                # Handle different possible JSON shapes (list of deps, or dict with 'results' list)
                deps = data if isinstance(data, list) else data.get('results', [])
                
                for dep in deps:
                    v = dep.get('V', 0.0)
                    o = dep.get('O', 0.0)
                    u = dep.get('U', 0.0)
                    d = dep.get('D', 0.0)
                    m = dep.get('M', 0.0)
                    features.append([v, o, u, d, m])
            except Exception as e:
                print(f"Failed to parse {filename}: {e}")
                
    if not features:
        print("No feature vectors found in JSON files. Using dummy data.")
        np.random.seed(42)
        features = np.random.rand(100, 5).tolist()
        
    return np.array(features)

def evaluate_silhouette():
    # Use a generic path or assume the user mounts a dataset here
    data_dir = os.path.join(os.path.dirname(__file__), "..", "..", "test_repos")
    X = load_data(data_dir)
    
    k_values = range(2, 7)
    silhouette_scores = []
    
    print(f"Evaluating clustering on {len(X)} dependencies...")
    print(f"{'k':<5} | {'Silhouette Score':<20}")
    print("-" * 30)
    
    for k in k_values:
        kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = kmeans.fit_predict(X)
        score = silhouette_score(X, labels)
        silhouette_scores.append(score)
        print(f"{k:<5} | {score:<20.4f}")
        
    # Plotting
    plt.figure(figsize=(8, 5))
    plt.plot(k_values, silhouette_scores, marker='o', linestyle='-', color='b')
    plt.title('Silhouette Score vs. Number of Clusters (k)')
    plt.xlabel('Number of Clusters (k)')
    plt.ylabel('Silhouette Score')
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.xticks(k_values)
    
    out_file = os.path.join(os.path.dirname(__file__), "silhouette_evaluation.png")
    plt.savefig(out_file)
    print(f"\nSaved evaluation chart to {out_file}")

if __name__ == "__main__":
    evaluate_silhouette()
