"""Capture a fresh local scan and optional baselines against a verified commit."""
import argparse
import importlib.metadata
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from .evaluation_data import load_features, sha256
    from .compare_baselines import npm_high, snyk_high
except ImportError:
    from evaluation_data import load_features, sha256
    from compare_baselines import npm_high, snyk_high


def now():
    return datetime.now(timezone.utc).isoformat()


def run(command, cwd, timeout=180):
    return subprocess.run(command, cwd=cwd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout, check=False)


def git_value(git, repo, *args):
    result = run([git, *args], repo)
    if result.returncode:
        raise ValueError(f"Git command failed: {result.stderr.strip()}")
    return result.stdout.strip()


def snapshot(repo, commit, git, sample_type):
    repo = Path(repo).resolve()
    if not repo.is_dir():
        raise ValueError(f"Repository not found: {repo}")
    actual = git_value(git, repo, "rev-parse", "HEAD")
    # Full immutable SHA only. Do not silently resolve moving branch names.
    if len(commit) != 40 or actual.lower() != commit.lower():
        raise ValueError(f"Expected full commit {commit}; checkout is {actual}")
    if git_value(git, repo, "status", "--porcelain", "--untracked-files=normal"):
        raise ValueError("Evaluation requires a clean checkout, including no untracked source files")
    lock, manifest = repo / "package-lock.json", repo / "package.json"
    if not lock.is_file() or not manifest.is_file():
        raise ValueError("Both package.json and package-lock.json are required; do not generate a new lockfile for historical evaluation")
    git_value(git, repo, "ls-files", "--error-unmatch", "package.json", "package-lock.json")
    data = json.loads(lock.read_text(encoding="utf-8"))
    if data.get("lockfileVersion") not in (2, 3) or not data.get("packages"):
        raise ValueError("Current scanner evaluation requires an npm v2/v3 lockfile with packages")
    origin = run([git, "remote", "get-url", "origin"], repo)
    return {"path": str(repo), "commit": actual, "origin": origin.stdout.strip() if origin.returncode == 0 else None,
            "sample_type": sample_type, "lock_sha256": sha256(lock), "manifest_sha256": sha256(manifest)}


def capture_tool(executable, arguments, repo, extractor):
    version = run([executable, "--version"], repo)
    if version.returncode:
        raise ValueError(f"Could not obtain tool version: {executable}")
    started = now()
    result = run([executable, *arguments], repo, timeout=600)
    saved = {"status": "failed", "command": [executable, *arguments], "version": version.stdout.strip(),
             "started_at": started, "finished_at": now(), "exit_code": result.returncode,
             "stdout": result.stdout, "stderr": result.stderr}
    try:
        data = json.loads(result.stdout)
        extractor(data)
        # Both tools use exit code 1 for successful scans with findings.
        if result.returncode not in (0, 1):
            raise ValueError(f"Tool failed with exit code {result.returncode}")
        saved.update(status="complete", data=data)
    except (ValueError, KeyError, TypeError) as exc:
        saved["error"] = str(exc)
    return saved


def analyze_local(repo):
    # Import lazily: --help and baseline report parsing require no API credentials.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    from analyzer import analyze_manifest
    content = json.loads((Path(repo) / "package-lock.json").read_text(encoding="utf-8"))
    # Manifest-only scope for all tools; usage is unknown, not measured reachability.
    results = analyze_manifest("package-lock.json", content, usage_map=None, strict_errors=True)
    if not results:
        raise ValueError("No dependencies returned")
    for dep in results:
        if any(key not in dep for key in ("V", "O", "U", "D", "M", "R")):
            raise ValueError(f"Incomplete analysis for {dep.get('name')}; refusing a research export")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, help="Clean local clone at the specified commit")
    parser.add_argument("--commit", required=True, help="Full 40-character commit SHA")
    parser.add_argument("--sample-type", required=True, choices=["training", "production"])
    parser.add_argument("--output", required=True, help="New output directory outside the scanned checkout")
    parser.add_argument("--git", default=shutil.which("git") or "git")
    parser.add_argument("--npm", default=shutil.which("npm.cmd") or shutil.which("npm") or "npm")
    parser.add_argument("--snyk", help="Optional Snyk executable; requires an authenticated account")
    parser.add_argument("--run-npm-audit", action="store_true", help="Submit dependency metadata to configured npm registry")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    repo = Path(args.repo).resolve()
    if output == repo or repo in output.parents:
        parser.error("Output must be outside the scanned checkout")
    if output.exists():
        parser.error("Use a new output directory to preserve prior captures")
    payload = {"schema_version": 1, "scan_started_at": now(), "scope": "all_dependencies_manifest_only",
               "usage_measurement": "unavailable; no source usage scan performed",
               "scoring_model": "current backend/scoring.py; not paper Equation 10"}
    try:
        payload["repository"] = snapshot(repo, args.commit, args.git, args.sample_type)
        payload["results"] = analyze_local(repo)
        payload["scan_finished_at"] = now()
        backend = Path(__file__).resolve().parents[1]
        payload["implementation_hashes"] = {name: sha256(backend / name) for name in ("analyzer.py", "scoring.py", "action_clustering.py")}
        payload["python_packages"] = {name: importlib.metadata.version(name) for name in ("numpy", "scikit-learn", "requests")}
        if args.run_npm_audit:
            payload["npm_audit"] = capture_tool(args.npm, ["audit", "--json", "--package-lock-only", "--include=dev", "--include=optional", "--include=peer"], repo, npm_high)
        if args.snyk:
            payload["snyk"] = capture_tool(args.snyk, ["test", "--json", "--dev", "--file=package-lock.json", "--package-manager=npm"], repo, snyk_high)
        if snapshot(repo, args.commit, args.git, args.sample_type) != payload["repository"]:
            raise ValueError("Repository changed during capture; results cannot be compared")
        output.mkdir(parents=True)
        path = output / "scan_capture.json"
        path.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
        load_features(path)  # Verify that the saved capture is directly evaluable.
        if any(payload.get(tool, {}).get("status") == "failed" for tool in ("npm_audit", "snyk")):
            parser.exit(1, f"Baseline failed; diagnostics preserved in {path}. Do not report as zero findings.\n")
    except (ValueError, RuntimeError, OSError, subprocess.TimeoutExpired) as exc:
        parser.exit(2, f"Capture failed: {exc}\n")
    print(f"Saved measured scan to {path}")


if __name__ == "__main__":
    main()
