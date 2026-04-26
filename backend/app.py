"""
DepShield Backend — Flask API server.

Existing Endpoints (UNCHANGED):
  POST /api/scan       — Clone a GitHub repo and analyze its dependencies
  POST /api/scan-file  — Analyze an uploaded package.json / package-lock.json
  GET  /api/health     — Health check

New Endpoints (GitHub Integration):
  GET  /api/auth/github          — Redirect to GitHub OAuth
  GET  /api/auth/github/callback — Exchange code → JWT → redirect to frontend
  GET  /api/auth/me              — Return current user from JWT
  GET  /api/dashboard/repos      — List user's connected repos
  GET  /api/dashboard/scan-history/<repo> — Get scan history for a repo
  POST /api/github/webhook       — Handle GitHub App webhook events
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

# ─── NEW: GitHub OAuth + App imports ──────────────────────────────────────────
try:
    from .auth import (
        get_github_oauth_url, exchange_code_for_token,
        fetch_github_user, create_jwt, require_auth,
        get_installation_access_token,
    )
    from .github_app import (
        verify_webhook_signature, handle_push_event,
        handle_installation_event, handle_installation_repositories_event,
    )
    from . import db_adapter as adapter
except (ImportError, ValueError):
    from auth import (
        get_github_oauth_url, exchange_code_for_token,
        fetch_github_user, create_jwt, require_auth,
        get_installation_access_token,
    )
    from github_app import (
        verify_webhook_signature, handle_push_event,
        handle_installation_event, handle_installation_repositories_event,
    )
    import db_adapter as adapter
# ─────────────────────────────────────────────────────────────────────────────

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


# ═══════════════════════════════════════════════════════════════════════════════
# NEW ROUTES — GitHub OAuth + App Integration
# All existing routes above are UNCHANGED.
# ═══════════════════════════════════════════════════════════════════════════════


# ─── GITHUB OAUTH ─────────────────────────────────────────────────────────────

@app.route("/api/auth/github", methods=["GET"])
def github_oauth_redirect():
    """
    Step 1 of OAuth: Redirect the user to GitHub's authorization page.

    The user clicks "Sign in with GitHub" → the browser hits this endpoint
    → we redirect them to github.com/login/oauth/authorize with our client_id.

    After the user approves, GitHub redirects them to /api/auth/github/callback.
    """
    # Build the callback URL
    # We strip any accidental whitespace and force HTTPS in production
    frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")
    if frontend_url and "localhost" not in frontend_url:
        callback_url = frontend_url + "/api/auth/github/callback"
    else:
        # Fallback to current request host if FRONTEND_URL is missing
        clean_host = request.host_url.strip().rstrip("/")
        callback_url = clean_host.replace("http://", "https://") + "/api/auth/github/callback"
        # Localhost exception
        if "localhost" in request.host:
            callback_url = request.host_url.rstrip("/") + "/api/auth/github/callback"

    # State parameter for CSRF protection
    import secrets
    state = secrets.token_urlsafe(16)
    
    print(f"[DepShield] Initiating GitHub OAuth. Using Callback: {callback_url}")

    # Build the authorization URL
    # In production, we omit the redirect_uri to let GitHub use the registered one.
    # This prevents character mismatch errors.
    is_prod = os.environ.get("FRONTEND_URL") and "localhost" not in os.environ.get("FRONTEND_URL", "")
    
    try:
        if is_prod:
            auth_url = get_github_oauth_url(state=state)
        else:
            auth_url = get_github_oauth_url(redirect_uri=callback_url, state=state)
            
        return jsonify({"url": auth_url, "state": state})
    except ValueError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/github/callback", methods=["GET"])
def github_oauth_callback():
    """
    Step 2 of OAuth: Handle the callback from GitHub.

    GitHub redirects here with ?code=XXX&state=YYY after the user approves.
    We:
      1. Exchange the code for an access_token
      2. Fetch the user's GitHub profile
      3. Save/update the user via adapter
      4. Create a JWT session token
      5. Redirect to the frontend with the token in the URL fragment
    """
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Missing authorization code"}), 400

    # Exchange the temporary code for a GitHub access token
    access_token = exchange_code_for_token(code)
    if not access_token:
        return jsonify({"error": "Failed to exchange code for token"}), 401

    # Fetch the user's GitHub profile
    github_user = fetch_github_user(access_token)
    if not github_user:
        return jsonify({"error": "Failed to fetch GitHub user profile"}), 401

    # Save the user via adapter (teammate replaces with Supabase)
    user_data = adapter.save_user({
        "github_id": github_user["github_id"],
        "login": github_user["login"],
        "avatar_url": github_user["avatar_url"],
        "name": github_user.get("name", github_user["login"]),
        "email": github_user.get("email", ""),
        "access_token": access_token,
    })

    if "error" in user_data:
        print(f"[DepShield] Error saving user during OAuth: {user_data['error']}")
        return jsonify({"error": "Failed to save user to database. Have you created the tables in Supabase?"}), 500

    # Create a JWT for the frontend session
    token = create_jwt(user_data)

    # Redirect to the frontend with the token
    # For a monolith, a relative redirect is the most robust way to stay on the same domain.
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if not frontend_url or "localhost" in frontend_url:
        redirect_url = f"/?auth_token={token}"
    else:
        redirect_url = f"{frontend_url}/?auth_token={token}"
    
    print(f"[DepShield] OAuth Success. Redirecting to: {redirect_url}")
    from flask import redirect as flask_redirect
    return flask_redirect(redirect_url)


@app.route("/api/auth/me", methods=["GET"])
@require_auth
def get_current_user():
    """
    Return the current authenticated user's info from the JWT.

    Protected route — requires Authorization: Bearer <token> header.
    The @require_auth decorator validates the JWT and sets request.user.
    """
    user = request.user
    return jsonify({
        "id": user.get("sub"),
        "github_id": user.get("github_id"),
        "login": user.get("login"),
        "avatar_url": user.get("avatar_url"),
        "name": user.get("name", user.get("login")),
    })


# ─── MONITORING DASHBOARD ────────────────────────────────────────────────────

@app.route("/api/dashboard/repos", methods=["GET"])
@require_auth
def list_repos():
    """
    List the authenticated user's connected repositories.

    Returns repos from the GitHub App installation, along with
    their latest scan status (grade, last scan time).
    """
    user_id = request.user.get("sub")
    print(f"[DepShield] list_repos called for user_id={user_id}")
    repos = adapter.get_user_repositories(user_id)

    # 5. Sync repositories with GitHub App installation (source of truth)
    inst = adapter.get_user_installation(user_id)
    if inst and inst.get("installation_id"):
        installation_id = inst.get("installation_id")
        print(f"[DepShield] Syncing repositories for installation_id={installation_id}")
        
        token = get_installation_access_token(installation_id)
        if token:
            import requests
            resp = requests.get(
                "https://api.github.com/installation/repositories",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json"
                }
            )
            if resp.ok:
                repos_data = resp.json().get("repositories", [])
                print(f"[DepShield] GitHub App returned {len(repos_data)} repositories for installation={installation_id}")
                
                # Sync logic: upsert current, remove those no longer in the list
                current_github_ids = [r["id"] for r in repos_data]
                
                # 1. Save/Update current repos
                repo_records = []
                for r in repos_data:
                    repo_records.append({
                        "github_repo_id": r["id"],
                        "full_name": r["full_name"],
                        "default_branch": r.get("default_branch", "main"),
                        "private": r.get("private", False)
                    })
                saved = adapter.save_repositories(installation_id, repo_records, user_id=user_id)
                print(f"[DepShield] Saved {len(saved)} repositories to database")
                
                # 2. Cleanup: remove repos in DB for this installation not in current_github_ids
                all_db_repos = adapter.get_user_repositories(user_id)
                # Filter to only those belonging to this installation
                inst_db_repos = [r for r in all_db_repos if r.get("installation_id") == installation_id]
                to_remove = [r["github_repo_id"] for r in inst_db_repos if r["github_repo_id"] not in current_github_ids]
                
                if to_remove:
                    adapter.remove_repositories(installation_id, to_remove)
                    print(f"[DepShield] Removed {len(to_remove)} orphaned repositories from database")
            else:
                print(f"[DepShield] Failed to fetch repositories from GitHub App: {resp.status_code}")
        else:
            print(f"[DepShield] Failed to generate installation token for {installation_id}")

    # Final list from DB (synced above)
    repos = adapter.get_user_repositories(user_id)

    # Enrich with latest scan data
    enriched = []
    for repo in repos:
        full_name = repo.get("full_name", "")
        # Use get_scan_results helper for consistency
        scans = adapter.get_scan_results(full_name, limit=1)
        latest_scan = scans[0] if scans else None
        
        enriched.append({
            "full_name": full_name,
            "private": repo.get("private", False),
            "last_scan_at": repo.get("last_scan_at"),
            "last_scan_grade": repo.get("last_scan_grade"),
            "latest_scan": {
                "grade": latest_scan["grade"],
                "risk_score": latest_scan["risk_score"],
                "total_deps": latest_scan["total_deps"],
                "critical": latest_scan["critical"],
                "high": latest_scan["high"],
                "scanned_at": latest_scan["scanned_at"],
            } if latest_scan else None,
        })

    print(f"[DepShield] Final dashboard repos count: {len(enriched)}")
    return jsonify(enriched)


@app.route("/api/dashboard/scan-history/<path:repo_full_name>", methods=["GET"])
@require_auth
def get_scan_history(repo_full_name):
    """
    Get scan history and latest full results for a specific repository.

    URL param: repo_full_name — e.g. "owner/repo"
    Query param: ?full=true — include full scan results (large payload)
    """
    include_full = request.args.get("full", "false").lower() == "true"
    scans = adapter.get_scan_results(repo_full_name, limit=20)

    if not include_full:
        # Strip the large 'results' array for the summary view
        for scan in scans:
            scan.pop("results", None)

    return jsonify(scans)


@app.route("/api/dashboard/scan/<path:repo_full_name>", methods=["POST"])
@require_auth
def trigger_scan(repo_full_name):
    """
    On-demand scan: fetch the repo's package.json/package-lock.json
    via the user's OAuth token, run the analyzer, and save results.
    """
    import time as _time
    from datetime import datetime, timezone

    t_start = _time.time()
    user_id = request.user.get("sub")
    github_id = request.user.get("github_id")
    print(f"[DepShield] On-demand scan triggered for {repo_full_name} by user_id={user_id}")

    # Get user's OAuth token from Supabase
    user_record = adapter.get_user_by_github_id(github_id) if github_id else None
    oauth_token = user_record.get("access_token") if user_record else None

    if not oauth_token:
        return jsonify({"error": "No GitHub access token found. Please re-login."}), 401

    # Try to fetch package-lock.json first, then package.json
    manifest_filename = None
    manifest_content = None

    for filename in ["package-lock.json", "package.json"]:
        try:
            parts = repo_full_name.split("/", 1)
            if len(parts) != 2:
                continue
            owner, repo = parts
            # Get default branch
            repo_resp = requests.get(
                f"https://api.github.com/repos/{repo_full_name}",
                headers={
                    "Authorization": f"Bearer {oauth_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                timeout=10
            )
            default_branch = "main"
            if repo_resp.ok:
                default_branch = repo_resp.json().get("default_branch", "main")

            # Use GitHub API to fetch file content (handles private repos correctly)
            api_url = f"https://api.github.com/repos/{repo_full_name}/contents/{filename}?ref={default_branch}"
            resp = requests.get(
                api_url,
                headers={
                    "Authorization": f"Bearer {oauth_token}",
                    "Accept": "application/vnd.github.v3+json"
                },
                timeout=15
            )
            if resp.status_code == 200:
                import base64
                data = resp.json()
                content_base64 = data.get("content", "")
                content_bytes = base64.b64decode(content_base64)
                manifest_content = json.loads(content_bytes.decode("utf-8"))
                manifest_filename = filename
                print(f"[DepShield] Fetched {filename} from {repo_full_name} via API")
                break
        except Exception as e:
            print(f"[DepShield] Error fetching {filename}: {e}")
            continue

    if not manifest_content:
        return jsonify({"error": f"Could not find package.json or package-lock.json in {repo_full_name}"}), 404

    # Run the EXISTING analyzer pipeline — same as /api/scan and webhooks
    try:
        results = analyze_manifest(manifest_filename, manifest_content, usage_map=None)

        # Calculate summary metrics (same formula as github_app.py)
        total = len(results)
        critical = sum(1 for d in results if d.get("sev") == "CRITICAL")
        high = sum(1 for d in results if d.get("sev") == "HIGH")
        medium = sum(1 for d in results if d.get("sev") == "MEDIUM")
        low = sum(1 for d in results if d.get("sev") == "LOW")
        safe_count = total - critical - high - medium - low

        health_score = (safe_count * 100 + low * 50 + medium * 15 + high * 5) / max(total, 1)
        sev_penalty = min(50, critical * 15 + high * 5)
        risk = max(0, min(100, round(health_score - sev_penalty)))
        grade = "A" if risk >= 90 else "B" if risk >= 75 else "C" if risk >= 55 else "D" if risk >= 35 else "F"

        scan_data = {
            "grade": grade,
            "risk_score": risk,
            "total_deps": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "results": results,
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "trigger": "manual",
            "manifest": manifest_filename,
        }

        # Save to Supabase
        adapter.save_scan_result(repo_full_name, scan_data, triggered_by="manual")

        elapsed = _time.time() - t_start
        print(f"[DepShield] On-demand scan complete for {repo_full_name}: grade={grade}, deps={total}, time={elapsed:.2f}s")

        return jsonify({
            "success": True,
            "repo": repo_full_name,
            "grade": grade,
            "risk_score": risk,
            "total_deps": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "scanned_at": scan_data["scanned_at"],
            "results": results,
        })

    except Exception as e:
        print(f"[DepShield] Scan failed for {repo_full_name}: {e}")
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


# ─── GITHUB APP WEBHOOK ──────────────────────────────────────────────────────

@app.route("/api/github/store-installation", methods=["POST"])
@require_auth
def store_installation():
    data = request.json
    installation_id = data.get("installation_id")
    if not installation_id:
        return jsonify({"error": "missing installation_id"}), 400

    user_id = request.user.get("sub")
    github_id = request.user.get("github_id")
    print(f"[DepShield] store-installation called")
    print(f"[DepShield] installation_id received: {installation_id}")
    print(f"[DepShield] user_id resolved: {user_id}")

    adapter.save_installation(user_id, {
        "installation_id": int(installation_id),
        "account_login": request.user.get("login", "unknown"),
        "account_type": "User"
    })
    print("[DepShield] installation saved to Supabase")

    # Strategy 1: Try GitHub App installation token (requires private-key.pem)
    token = get_installation_access_token(int(installation_id))
    repos_fetched = False

    if token:
        print(f"[DepShield] installation token generated via App JWT for installation={installation_id}")
        import requests as req
        resp = req.get(
            "https://api.github.com/installation/repositories",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json"
            }
        )
        if resp.ok:
            repos_data = resp.json().get("repositories", [])
            print(f"[DepShield] GitHub App returned {len(repos_data)} repositories for installation={installation_id}")
            
            saved_repos = []
            for r in repos_data:
                saved_repos.append({
                    "github_repo_id": r["id"],
                    "full_name": r["full_name"],
                    "default_branch": r.get("default_branch", "main"),
                    "private": r.get("private", False)
                })
            saved = adapter.save_repositories(int(installation_id), saved_repos, user_id=user_id)
            print(f"[DepShield] Saved {len(saved)} repositories to database")
            repos_fetched = True
    else:
        print(f"[DepShield] ERROR: Failed to generate installation token for {installation_id}. Webhooks will fail.")

    return jsonify({"success": repos_fetched})


@app.route("/api/github/webhook", methods=["POST"])
def github_webhook():
    """
    Receive and process GitHub App webhook events.

    GitHub sends POST requests here for events like:
      - "push" — code was pushed to a repo
      - "installation" — App was installed/uninstalled
      - "installation_repositories" — repo selection changed

    The payload is verified using HMAC-SHA256 signature before processing.
    """
    # Verify webhook signature for security
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_webhook_signature(request.data, signature):
        return jsonify({"error": "Invalid webhook signature"}), 403

    event_type = request.headers.get("X-GitHub-Event", "")
    delivery_id = request.headers.get("X-GitHub-Delivery", "")
    payload = request.get_json(force=True)

    # Log the webhook event via adapter
    adapter.save_webhook_event({
        "event_type": event_type,
        "delivery_id": delivery_id,
        "repository": payload.get("repository", {}).get("full_name", ""),
        "action": payload.get("action", ""),
        "received_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
    })

    # Route to the appropriate handler
    if event_type == "push":
        result = handle_push_event(payload)
    elif event_type == "installation":
        result = handle_installation_event(payload)
    elif event_type == "installation_repositories":
        result = handle_installation_repositories_event(payload)
    elif event_type == "ping":
        # GitHub sends a ping when the webhook is first configured
        result = {"status": "pong"}
    else:
        result = {"status": "ignored", "event": event_type}

    return jsonify(result)


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
    print(f"[DepShield] Frontend redirect URL: {os.environ.get('FRONTEND_URL', 'http://localhost:5173')}")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
