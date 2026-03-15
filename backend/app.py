"""
DepShield Backend — Flask API server.

Endpoints:
  POST /api/scan       — Clone a GitHub repo and analyze its dependencies
  POST /api/scan-file  — Analyze an uploaded package.json / package-lock.json
  GET  /api/health     — Health check
"""

import os
import json
import shutil
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
from git import Repo

from analyzer import analyze_manifest

app = Flask(__name__)
CORS(app)


# Check if git is available
GIT_AVAILABLE = False
try:
    import subprocess
    subprocess.check_output(["git", "--version"])
    GIT_AVAILABLE = True
except Exception:
    print("[DepShield] Warning: git executable not found. GitHub URL scanning will fail.")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "git_available": GIT_AVAILABLE,
        "environment": "localhost"
    })


@app.route("/api/scan", methods=["POST"])
def scan_repo():
    """
    Clone a GitHub repo, find package.json or package-lock.json, analyze it.
    Body: { "repoUrl": "https://github.com/owner/repo" }
    """
    data = request.get_json(force=True)
    repo_url = data.get("repoUrl", "").strip()

    if not repo_url:
        return jsonify({"error": "repoUrl is required"}), 400

    # Normalize GitHub URL
    if not repo_url.endswith(".git"):
        repo_url_git = repo_url.rstrip("/") + ".git"
    else:
        repo_url_git = repo_url

    tmp_dir = tempfile.mkdtemp(prefix="depshield_")

    try:
        print(f"\n[DepShield] Cloning {repo_url} ...")
        Repo.clone_from(repo_url_git, tmp_dir, depth=1)

        # Look for manifest
        lock_path = os.path.join(tmp_dir, "package-lock.json")
        pkg_path = os.path.join(tmp_dir, "package.json")

        if os.path.exists(lock_path):
            manifest_path = lock_path
            filename = "package-lock.json"
        elif os.path.exists(pkg_path):
            manifest_path = pkg_path
            filename = "package.json"
        else:
            return jsonify({"error": "No package.json or package-lock.json found in repository"}), 400

        print(f"[DepShield] Found {filename}, analyzing...")
        with open(manifest_path, "r", encoding="utf-8") as f:
            content = json.load(f)

        deps = analyze_manifest(filename, content)
        print(f"[DepShield] Done — {len(deps)} dependencies scanned")

        return jsonify(deps)

    except Exception as e:
        print(f"[DepShield] Error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        # Cleanup cloned repo
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


@app.route("/api/scan-file", methods=["POST"])
def scan_file():
    """
    Analyze a raw package.json or package-lock.json content.
    Body: { "filename": "package.json", "content": { ... } }
    """
    data = request.get_json(force=True)
    content = data.get("content")
    filename = data.get("filename", "package.json")

    if not content:
        return jsonify({"error": "content is required"}), 400

    # Parse if string
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except json.JSONDecodeError:
            return jsonify({"error": "Invalid JSON content"}), 400

    try:
        print(f"\n[DepShield] Scanning file: {filename}")
        deps = analyze_manifest(filename, content)
        print(f"[DepShield] Done — {len(deps)} dependencies scanned")
        return jsonify(deps)
    except Exception as e:
        print(f"[DepShield] Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[DepShield] Backend running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
