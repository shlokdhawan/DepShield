"""Evaluate k=2..8 on preserved features and export k=3/k=4 evidence."""
import argparse
import json
import platform
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import sklearn
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score

try:
    from .evaluation_data import FACTORS, load_features, write_csv
except ImportError:
    from evaluation_data import FACTORS, load_features, write_csv


def evaluate(source, output, seeds=(42, 7, 21, 84, 123), k_values=range(2, 9)):
    rows, sources = load_features(source)
    seeds = tuple(dict.fromkeys(seeds))
    if not seeds:
        raise ValueError("At least one random seed is required")
    X = np.asarray([r["features"] for r in rows], dtype=float)
    unique = len(np.unique(X, axis=0))
    runs, assignments, centroids, models, skipped = [], [], [], {}, []
    for k in k_values:
        if k >= len(X) or k > unique:
            skipped.append({"k": k, "reason": "Requires k < samples and k <= distinct feature rows"})
            continue
        for seed in seeds:
            model = KMeans(n_clusters=k, n_init=10, random_state=seed).fit(X)
            if len(set(model.labels_)) != k:
                raise ValueError(f"K-means produced fewer than {k} clusters")
            runs.append({"k": k, "seed": seed, "inertia": float(model.inertia_),
                         "silhouette": float(silhouette_score(X, model.labels_))})
            models[k, seed] = model
            if k not in (3, 4):
                continue
            for i, row in enumerate(rows):
                assignments.append({"k": k, "seed": seed, "cluster_id": int(model.labels_[i]),
                                    "source": row["source"], "row": row["row"], "package": row["package"]})
            for cluster in range(k):
                indices = np.flatnonzero(model.labels_ == cluster)
                risks = [rows[i]["R"] for i in indices if rows[i]["R"] is not None]
                centroid = dict(zip(FACTORS, np.mean(X[indices], axis=0).tolist()))
                centroids.append({"k": k, "seed": seed, "cluster_id": cluster, "size": len(indices),
                                  **centroid, "mean_R": float(np.mean(risks)) if risks else None,
                                  "R_observed_count": len(risks),
                                  "paper_equation_mean_R": float(np.mean([rows[i]["paper_equation_R"] for i in indices]))})
    if not all((k, seeds[0]) in models for k in (3, 4)):
        raise ValueError("Comparison needs valid k=3 and k=4 runs: at least 5 samples and 4 distinct rows")
    summary = []
    for k in sorted({r["k"] for r in runs}):
        subset = [r for r in runs if r["k"] == k]
        stability = [adjusted_rand_score(models[k, seeds[0]].labels_, models[k, seed].labels_) for seed in seeds[1:]]
        summary.append({"k": k, "silhouette_mean": float(np.mean([r["silhouette"] for r in subset])),
                        "silhouette_std": float(np.std([r["silhouette"] for r in subset])),
                        "inertia_mean": float(np.mean([r["inertia"] for r in subset])),
                        "ari_to_first_seed_mean": float(np.mean(stability)) if stability else None})
    best = max(summary, key=lambda r: (r["silhouette_mean"], -r["k"]))["k"]
    crossing = Counter(zip(models[3, seeds[0]].labels_.tolist(), models[4, seeds[0]].labels_.tolist()))
    observed = [r for r in rows if r["R"] is not None]
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(), "sources": sources,
        "sample_count": len(rows), "distinct_feature_rows": unique,
        "preprocessing": "Saved normalized V/O/U/D/M unchanged; no additional scaling, imputation or deduplication",
        "python_version": platform.python_version(), "numpy_version": np.__version__, "sklearn_version": sklearn.__version__,
        "n_init": 10, "seeds": list(seeds), "primary_seed": seeds[0],
        "selection_criterion": "Highest mean silhouette among tested valid k; lower k breaks exact ties",
        "best_k_by_mean_silhouette": best, "summary": summary, "runs": runs, "skipped": skipped,
        "centroids": centroids,
        "k3_k4_cross_tab": [{"k3_cluster": a, "k4_cluster": b, "count": count} for (a, b), count in sorted(crossing.items())],
        "paper_equation_audit": {"rows_with_observed_R": len(observed),
                                 "max_absolute_difference": max((abs(r["R"] - r["paper_equation_R"]) for r in observed), default=None)},
        "limitations": ["Cluster IDs have no inherent action meaning.",
                        "Silhouette measures separation, not security accuracy or remediation usefulness.",
                        "Supplied data is not automatically the original paper dataset.",
                        "Metrics use raw K-means assignments before critical-risk action overrides."],
    }
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "clustering_evaluation.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    write_csv(output / "cluster_centroids.csv", centroids, ["k", "seed", "cluster_id", "size", *FACTORS, "mean_R", "R_observed_count", "paper_equation_mean_R"])
    write_csv(output / "package_assignments.csv", assignments, ["k", "seed", "cluster_id", "source", "row", "package"])
    write_csv(output / "cluster_metrics.csv", runs, ["k", "seed", "inertia", "silhouette"])
    text = ["# Clustering evaluation", "", f"Measured {len(rows)} saved feature rows. Best mean silhouette among tested k: **{best}**.", "",
            "| k | Mean silhouette | Standard deviation | Mean inertia |", "|---|---:|---:|---:|"]
    text += [f"| {r['k']} | {r['silhouette_mean']:.6f} | {r['silhouette_std']:.6f} | {r['inertia_mean']:.6f} |" for r in summary]
    text += ["", "Compare centroids and the k=3/k=4 cross-tab before assigning action meanings. No optimum at k=4 is assumed.",
             "", "The JSON records input hashes, settings, individual runs, stability and differences from Equation 10.",
             "", "This run does not validate reduced false positives, developer utility, or historical paper results."]
    (output / "clustering_report.md").write_text("\n".join(text) + "\n", encoding="utf-8")
    plot(summary, best, output)
    return report


def plot(summary, best, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    ks = [r["k"] for r in summary]
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5))
    axes[0].plot(ks, [r["inertia_mean"] for r in summary], "o-")
    axes[0].set(title="Elbow diagnostic", ylabel="Mean inertia")
    axes[1].errorbar(ks, [r["silhouette_mean"] for r in summary],
                     yerr=[r["silhouette_std"] for r in summary], fmt="o-", capsize=4)
    axes[1].axvline(best, color="green", linestyle="--", label=f"Best mean silhouette: k={best}")
    axes[1].axvline(4, color="gray", linestyle=":", label="Current operational choice: k=4")
    axes[1].set(title="Silhouette across random seeds", ylabel="Mean silhouette (error bars: standard deviation)")
    axes[1].legend(fontsize=8)
    for ax in axes:
        ax.set(xlabel="k", xticks=ks)
        ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(output / "cluster_diagnostics.png", dpi=180)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Real feature JSON/CSV file or directory")
    parser.add_argument("--output", default="evaluation/clustering")
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 7, 21, 84, 123])
    args = parser.parse_args()
    try:
        report = evaluate(args.source, args.output, args.seeds)
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Evaluation failed: {exc}\n")
    print(f"Best mean silhouette: k={report['best_k_by_mean_silhouette']}; outputs: {args.output}")


if __name__ == "__main__":
    main()
