"""
DepShield Backend — Flask API server.

Endpoints:
  POST /api/scan       — Clone a GitHub repo and analyze its dependencies
  POST /api/scan-file  — Analyze an uploaded package.json / package-lock.json
  GET  /api/health     — Health check
"""

import os
from dotenv import load_dotenv
load_dotenv()

import json
import shutil   
import tempfile
import requests
import re
import logging
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler

try:
    from .threat_intel import update_threat_intelligence
except (ImportError, ValueError):
    from threat_intel import update_threat_intelligence

try:
    from .analyzer import analyze_manifest
except (ImportError, ValueError):
    from analyzer import analyze_manifest

app = Flask(__name__, static_folder="../dist", static_url_path="/")
CORS(app)

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path != "" and os.path.exists(app.static_folder + "/" + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, "index.html")

# Check if git is available
GIT_AVAILABLE = False
try:
    from git import Repo
    import subprocess
    subprocess.check_output(["git", "--version"])
    GIT_AVAILABLE = True
except Exception:
    print("[DepShield] Warning: git executable not found. GitHub URL scanning will be limited.")


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "git": GIT_AVAILABLE})


def fetch_github_api(repo_url):
    """
    Attempt to fetch package-lock.json or package.json via GitHub REST API.
    Works for public repos without needing 'git clone'.
    """
    # Parse owner/repo from URL
    # https://github.com/owner/repo -> owner/repo
    match = re.search(r"github\.com/([^/]+)/([^/.]+)", repo_url)
    if not match:
        return None, None
    
    owner, repo = match.groups()
    
    for filename in ["package-lock.json", "package.json"]:
        try:
            # Try 'main' branch
            r = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/main/{filename}", timeout=10)
            if r.status_code == 200:
                return filename, r.json()
            
            # If 'main' is missing, try 'master' branch
            r = requests.get(f"https://raw.githubusercontent.com/{owner}/{repo}/master/{filename}", timeout=10)
            if r.status_code == 200:
                return filename, r.json()
        except Exception:
            continue
            
    return None, None

def scan_codebase_usage(directory):
    """
    Scan JS/TS files in a directory to find require() and import statements.
    Returns a dict mapping package name to number of files it's imported in.
    """
    usage_counts = {}
    import re
    # Match: import ... from 'pkg' or import ... from "pkg"
    import_re = re.compile(r"import\s+.*?from\s+['\"]([^'\"]+)['\"]", re.MULTILINE)
    # Match: require('pkg') or require("pkg")
    require_re = re.compile(r"require\(['\"]([^'\"]+)['\"]\)", re.MULTILINE)

    for root, dirs, files in os.walk(directory):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".git" in dirs:
            dirs.remove(".git")
        if "dist" in dirs:
            dirs.remove("dist")
        if "build" in dirs:
            dirs.remove("build")

        for file in files:
            if file.endswith((".js", ".jsx", ".ts", ".tsx")):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        
                        found_pkgs = set()
                        for match in import_re.finditer(content):
                            pkg = match.group(1).split('/')[0]
                            if match.group(1).startswith('@'):
                                parts = match.group(1).split('/')
                                if len(parts) >= 2:
                                    pkg = f"{parts[0]}/{parts[1]}"
                            if not pkg.startswith('.'):
                                found_pkgs.add(pkg)
                                
                        for match in require_re.finditer(content):
                            pkg = match.group(1).split('/')[0]
                            if match.group(1).startswith('@'):
                                parts = match.group(1).split('/')
                                if len(parts) >= 2:
                                    pkg = f"{parts[0]}/{parts[1]}"
                            if not pkg.startswith('.'):
                                found_pkgs.add(pkg)
                        
                        for pkg in found_pkgs:
                            usage_counts[pkg] = usage_counts.get(pkg, 0) + 1
                except Exception:
                    pass
    return usage_counts


@app.route("/api/scan", methods=["POST"])
def scan_repo():
    """
    Clone a GitHub repo, find package.json or package-lock.json, analyze it.
    Body: { "repoUrl": "https://github.com/owner/repo" }
    """
    data = request.get_json(force=True)
    repo_url = data.get("repoUrl", "").strip()

    import time
    t_start = time.time()

    if not repo_url:
        return jsonify({"error": "repoUrl is required"}), 400

    if not GIT_AVAILABLE:
        print(f"[DepShield] Git unavailable, trying GitHub API for {repo_url}...")
        filename, content = fetch_github_api(repo_url)
        if content:
            deps = analyze_manifest(filename, content, usage_map=None)
            print(f"[DepShield Timing] Total via GitHub API: {time.time() - t_start:.2f}s")
            return jsonify(deps)
        return jsonify({"error": "Git is not installed and GitHub API fetch failed. URL scanning is unavailable in this environment. Please use 'Upload File' instead."}), 501

    # Normalize GitHub URL
    if not repo_url.endswith(".git"):
        repo_url_git = repo_url.rstrip("/") + ".git"
    else:
        repo_url_git = repo_url

    tmp_dir = tempfile.mkdtemp(prefix="depshield_")

    try:
        t1 = time.time()
        print(f"\n[DepShield] Cloning {repo_url} ...")
        import subprocess
        try:
            subprocess.run(
                [
                    "git", 
                    "-c", "http.postBuffer=524288000", 
                    "-c", "http.version=HTTP/1.1", 
                    "clone", 
                    "--depth=1", 
                    repo_url_git, 
                    tmp_dir
                ],
                check=True,
                capture_output=True
            )
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.decode('utf-8') if e.stderr else str(e)
            print(f"[DepShield] Git clone failed. Falling back to GitHub API... Error: {err_msg}")
            filename, content = fetch_github_api(repo_url)
            if content:
                deps = analyze_manifest(filename, content, usage_map=None)
                print(f"[DepShield Timing] Total via GitHub API fallback: {time.time() - t_start:.2f}s")
                return jsonify(deps)
            else:
                return jsonify({"error": f"Git clone failed and GitHub API fallback also failed. Git Error: {err_msg}"}), 500

        t_clone = time.time()
        print(f"[DepShield Timing] Git Clone: {t_clone - t1:.2f}s")

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

        usage_map = scan_codebase_usage(tmp_dir)
        t_usage = time.time()
        print(f"[DepShield Timing] Codebase Usage Scan: {t_usage - t_clone:.2f}s")

        deps = analyze_manifest(filename, content, usage_map=usage_map)
        print(f"[DepShield] Done — {len(deps)} dependencies scanned")
        print(f"[DepShield Timing] Total Full Scan: {time.time() - t_start:.2f}s")

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

    import time
    t_start = time.time()

    try:
        print(f"\n[DepShield] Scanning file: {filename}")
        deps = analyze_manifest(filename, content, usage_map=None)
        print(f"[DepShield] Done — {len(deps)} dependencies scanned")
        print(f"[DepShield Timing] Total File Scan: {time.time() - t_start:.2f}s")
        return jsonify(deps)
    except Exception as e:
        print(f"[DepShield] Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Start background threat intel job
    scheduler = BackgroundScheduler()
    scheduler.add_job(func=update_threat_intelligence, trigger="interval", hours=4)
    scheduler.start()
    
    # Run initial sync
    try:
        update_threat_intelligence()
    except Exception as e:
        print(f"[DepShield] Initial threat sync failed: {e}")

    port = int(os.environ.get("PORT", 5000))
    print(f"[DepShield] Backend running at http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
