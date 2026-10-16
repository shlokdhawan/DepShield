# Research evaluation and repair status

The submitted repair document requests two experiments: compare k=3 with k=4
on the original matrix, and compare DepShield with npm audit and optionally Snyk
on the same pinned repositories. The tooling below implements those experiments.
No new empirical results are claimed until real inputs have been supplied and run.

## What the supplied paper establishes

The 18-page paper `DepShield__1_.pdf` names OWASP Juice Shop, DVWS-node,
vulnerable-app, vulnerable-js-app, lodash, socket.io, eslint, prettier, axios,
winston and other projects. Figure 5 contains additional checkout-style labels.
These names are not unique repository URLs or immutable commit identifiers.
The paper contains neither a complete machine-readable sample manifest nor the
per-package matrix. Its centroid table cannot reconstruct the original samples.
The proposed 50–200-project evaluation in Section 10 is a future protocol, not
a recorded sample size or a list of completed baseline runs.

The paper already states in Sections 6.2, 8 and 9 that k=3 has a better
silhouette than k=4. The remaining gap is measured side-by-side evidence,
including whether cluster assignments actually support the claimed action distinction.
The submitted figure is not produced by the old evaluation script in this checkout:
that script used k=2–6, plotted only silhouette, and generated random features
when `test_repos` was missing. The checked-in old PNG must not be cited as real
sample evidence without its original inputs. It is retained as a historical artifact.

## Install and test

Use Python 3.11 or newer, Node/npm and Git for captures; Snyk is optional.

```console
python -m pip install -r requirements-evaluation.txt
python -B -m unittest discover -s backend/tests -v
```

Tests use deliberately controlled fixtures in temporary directories. Their plots
and scores are software checks, not experimental results for the paper.

## Experiment 1 Compare the original matrix

```console
python backend/scripts/evaluate_clustering.py path/to/original_features.csv --output evaluation/original-clustering
```

Accepted inputs are CSV rows with V/O/U/D/M columns, raw analyzer JSON lists,
JSON objects containing `results`, or exported report objects containing
`dependencies` with factor_V/factor_O/factor_U/factor_D/factor_M fields.
R or composite_risk_R is optional; it is never fabricated when absent.
A directory may contain only input feature JSON/CSV files; keep outputs elsewhere.
Missing, non-finite and out-of-range factors fail rather than silently becoming zero.
The legacy response.json lacks the factors and is intentionally rejected.

The evaluation uses the supplied normalized matrix unchanged, matching the current
application's lack of additional scaling. If the original experiment used different
preprocessing, recover that transformation first and explicitly document it.
It does not deduplicate rows across repositories: repeated package instances in
different repositories remain separate observations. Preserve original row order.

Outputs include a two-panel inertia/silhouette plot, per-seed metrics for k=2–8,
input SHA-256 hashes, Python/library versions, k=3 and k=4 centroids and sizes,
package assignments, a k=3/k=4 cross-tab for the first seed, and stability measured
by adjusted Rand index against that seed. Invalid k are recorded as skipped.
The mean-silhouette winner is selected from valid tested k, not fixed to three
or four. Error bars show standard deviation across seeds, not confidence intervals.
Raw cluster IDs are arbitrary and do not mean Safe, Replace or Fix This Week.
Inspect membership and centroid differences before interpreting or naming groups.
The evaluator computes metrics before application safety overrides.

## Experiment 2 Capture matching repository scans

Recover the exact repository URL, full 40-character commit, sample type
(training/production), lockfile and manifest for each original sample.
Use clean clones checked out at those commits; do not regenerate old lockfiles.
Do not substitute current branch heads and describe them as original data.
No authoritative repository list or commit pins can be inferred from the PDF alone.

```console
python backend/scripts/generate_report_json.py --repo path/to/clean-clone --commit FULL_COMMIT_SHA --sample-type production --output evaluation/captures/repo-name --run-npm-audit
python backend/scripts/compare_baselines.py evaluation/captures/repo-name/scan_capture.json --output evaluation/baselines
```

Add `--snyk path/to/snyk` to capture Snyk when an authenticated CLI is available.
Executable overrides `--git` and `--npm` support installations outside PATH.
Outputs must be outside the scanned checkout and in a new directory to preserve
earlier evidence. The tool does not install packages or execute repository scripts.
Core OSV and required npm metadata failures abort research captures through the
analyzer's strict-errors option, rather than recording them as no vulnerabilities.
Optional enrichment and AI advice can still be unavailable; those services are
not ground-truth labels. Missing OSV CVSS vectors use the existing severity fallback.
npm audit submits dependency metadata to the configured registry. It queries live
advisory data, so commit pins alone do not make results immutable over time.

The capture records commit, manifest/lock hashes, sample type, scan times,
implementation hashes, library/tool versions, commands, raw stdout/stderr, exit
codes, and parsed baseline results. Git status and input hashes are checked again
at the end. Both scans include dev dependencies. Manifest-only usage is explicitly
unavailable; these runs must not be used to validate source reachability claims.
Each CLI capture starts a fresh analyzer process, avoiding cross-repository in-memory
metadata caches. API credentials for optional AI services remain configuration inputs;
AI text caches are not frozen historical advisory snapshots.

Comparison counts unique package names because modern npm audit aggregates by name.
Repeated versions/paths are not counted as separate packages. It reports three
different DepShield sets: custom composite High/Critical, advisory High/Critical,
and any-advisory presence. They must not be described interchangeably.
The any-advisory set intentionally uses a broader threshold than the baseline.
npm's parent/metavulnerability propagation and differences in advisory coverage
must be considered when reviewing disagreements. Missing/failed tools are never
reported as zero findings. npm/Snyk exit code 1 with valid findings is accepted.
Snyk omission means npm-only, not an unperformed two-tool comparison.

Keep the training and production rows separate when interpreting results.
Report shared findings, tool-only names and Jaccard agreement; these are not
precision/recall. Shared advisory sources also prevent treating agreement as
independent ground truth. Label a defined evaluation set with an explicit rubric
and developer judgments before claiming accuracy, false-positive reduction,
actionability or triage-time improvements. Reviewing disagreements alone cannot
find issues missed by both tools.

## Scoring and architecture discrepancies to resolve

Equation 10 specifies R = .35V + .15O + .20U + .15D + .15M.
Because this is linear, applying those weights to cluster mean factors should
reproduce mean R, apart from rounding. Table 1 does not consistently satisfy that:

| Table 1 action | R from printed mean factors | Printed composite R |
|---|---:|---:|
| Fix This Week | 0.2650 | 0.32 |
| Replace | 0.1815 | 0.11 |
| Monitor | 0.1000 | 0.09 |
| Safe | 0.0780 | 0.07 |

Two-decimal rounding of factors and R can explain at most about 0.01 absolute
difference under these weights. The first two differences clearly exceed that.
Recover exact values and scoring provenance before replacing Table 1. Do not
present these recalculations as a new measurement of the original sample.
The evaluator reports observed mean R separately from Equation 10 recomputation.

The current backend uses a different custom CVSS-plus-penalties score; U and D
multipliers are disabled. Its O/U/D/M definitions also differ from Sections 4.1–4.2.
Changing only k does not resolve this model mismatch. Captures label the current
implementation explicitly and may support a new experiment, not reproduction
of the paper's equations. The paper also describes microservices, a queue, Redis,
relational graph edges, parser-based usage and minimum-safe-version selection;
this checkout has a synchronous Flask pipeline, regex import counts, simpler
origin traces and latest-version recommendations. Label these descriptions as
proposed architecture unless matching implementation and experiment evidence exists.

## Report replacement wording

### Cluster selection in Section 6.2

The supplied diagnostics favour k=3 by silhouette score (approximately 0.61,
compared with 0.46 for k=4), while the inertia curve has no decisive knee at four.
The four-cluster partition is an operational design choice, not a statistically
optimal result. Whether it creates useful distinctions beyond the three-cluster
solution remains to be measured on the preserved feature matrix. Four remediation
actions do not require four natural clusters, and no specific cluster merger is
assumed without checking package assignments.

### Results and discussion in Sections 7 and 8

The published four-cluster centroids are descriptive results reported in the
original manuscript. A reproducible comparison requires the corresponding
per-package data, scoring implementation and preprocessing. The added evaluation
tools export both partitions, per-seed separation metrics and assignment changes.
Until those inputs are recovered and the experiment is run, the comparative
advantage of four clusters remains unverified. Composite scores in Table 1 also
require reconciliation with Equation 10 before they support factor-contribution claims.

### Limitations in Section 9

The original feature matrix, immutable repository sample manifest and raw baseline
outputs were not supplied with the reviewed project. The three-versus-four-cluster
comparison and npm audit/Snyk agreement study have therefore not been completed
in this repair. Current code differs from the scoring equations and architecture
described in the manuscript. New captures must be reported as a separate experiment
unless the original implementation and inputs are recovered. Statistical cluster
separation is not evidence of improved security accuracy or remediation usefulness.

### Protocol and conclusion in Sections 10 and 11

The repaired tooling supports, but does not substitute for, the proposed empirical
evaluation. Run the original pinned samples when available, publish the measured
tables and raw outputs, and state whether the comparison includes npm audit alone
or both baselines. Any superiority, precision/recall or triage-time claims require
separate reference labels or user-study evidence. Four operational categories may
be retained provisionally, while the best statistical k and utility of each action
distinction remain empirical questions.
