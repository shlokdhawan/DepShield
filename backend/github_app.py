"""
DepShield — GitHub App Webhook & Installation Handler

This module processes incoming webhook events from the GitHub App:

  1. Push Events:
     - Checks if package.json or package-lock.json was modified
     - If yes: fetches the updated manifest via installation token
     - Calls the EXISTING analyze_manifest() pipeline (reuses, doesn't rebuild)
     - Saves scan result via the adapter layer

  2. Installation Events:
     - Fires when someone installs/uninstalls the GitHub App
     - Saves the installation_id and selected repositories via adapter

  3. Webhook Signature Verification:
     - Every webhook has an HMAC-SHA256 signature in X-Hub-Signature-256 header
     - We verify it against GITHUB_WEBHOOK_SECRET to prevent forgery

Webhook Flow:
  GitHub push → POST /api/github/webhook
  → verify_webhook_signature() — reject if invalid
  → route to handle_push_event() or handle_installation_event()
  → reuse existing analyzer → save results via adapter
"""

import os
import json
import hmac
import hashlib
import logging
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Import the existing analyzer — we REUSE it, not rebuild it
try:
    from .analyzer import analyze_manifest
    from .auth import get_installation_access_token
    from . import db_adapter as adapter
except (ImportError, ValueError):
    from analyzer import analyze_manifest
    from auth import get_installation_access_token
    import db_adapter as adapter

# ─── CONFIGURATION ─────────────────────────────────────────────────────────────

GITHUB_WEBHOOK_SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
GITHUB_APP_PRIVATE_KEY_PATH=os.environ.get("GITHUB_APP_PRIVATE_KEY_PATH", "./backend/private-key.pem")
GITHUB_API_URL = "https://api.github.com"

# Files that trigger a dependency scan when changed
TRIGGER_FILES = {"package.json", "package-lock.json"}


# ─── WEBHOOK SIGNATURE VERIFICATION ──────────────────────────────────────────

def verify_webhook_signature(payload_body: bytes, signature_header: str, secret: str = "") -> bool:
    """
    Verify the webhook payload signature using HMAC-SHA256.

    GitHub sends every webhook with an X-Hub-Signature-256 header containing:
        sha256=<hex-digest>

    We compute our own HMAC using the shared secret and compare.
    This prevents attackers from sending fake webhook events.

    Args:
        payload_body: Raw request body bytes
        signature_header: Value of X-Hub-Signature-256 header
        secret: The webhook secret (shared between GitHub and us)

    Returns:
        True if signature is valid, False otherwise
    """
    if not secret:
        secret = GITHUB_WEBHOOK_SECRET

    if not secret:
        # If no secret is configured, skip verification (dev mode only)
        logger.warning("[webhook] No GITHUB_WEBHOOK_SECRET set — skipping signature verification")
        return True

    if not signature_header:
        logger.warning("[webhook] Missing X-Hub-Signature-256 header")
        return False

    # Extract the hex digest from "sha256=<digest>"
    if not signature_header.startswith("sha256="):
        logger.warning("[webhook] Invalid signature format")
        return False

    expected_signature = signature_header[7:]  # Strip "sha256=" prefix

    # Compute HMAC-SHA256 of the payload using our shared secret
    computed = hmac.new(
        key=secret.encode("utf-8"),
        msg=payload_body,
        digestmod=hashlib.sha256,
    ).hexdigest()

    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(computed, expected_signature)


# ─── PUSH EVENT HANDLER ──────────────────────────────────────────────────────

def handle_push_event(payload: dict) -> dict:
    """
    Process a GitHub push event.

    Decision logic:
        1. Check which files were modified in the push
        2. If package.json or package-lock.json was changed → trigger scan
        3. Fetch the updated manifest using the installation access token
        4. Call analyze_manifest() (the EXISTING DepShield scanner)
        5. Save the scan result via adapter

    Args:
        payload: Full webhook payload from GitHub

    Returns:
        {"status": "scanned"/"skipped", "reason": "...", ...}
    """
    repo_full_name = payload.get("repository", {}).get("full_name", "unknown")
    installation_id = payload.get("installation", {}).get("id")
    default_branch = payload.get("repository", {}).get("default_branch", "main")
    ref = payload.get("ref", "")

    # Only scan pushes to the default branch
    if ref != f"refs/heads/{default_branch}":
        logger.info(f"[webhook] Skipping push to non-default branch: {ref}")
        return {"status": "skipped", "reason": f"Push was to {ref}, not {default_branch}"}

    # Check if any dependency files were modified
    changed_files = set()
    for commit in payload.get("commits", []):
        changed_files.update(commit.get("added", []))
        changed_files.update(commit.get("modified", []))

    trigger_files_found = changed_files & TRIGGER_FILES
    if not trigger_files_found:
        logger.info(f"[webhook] No dependency files changed in push to {repo_full_name}")
        return {"status": "skipped", "reason": "No package.json/package-lock.json changes"}

    logger.info(
        f"[webhook] Dependency file(s) changed in {repo_full_name}: {trigger_files_found}. "
        f"Triggering scan..."
    )

    # Get an installation access token to fetch the manifest
    if not installation_id:
        logger.error("[webhook] No installation_id in push event payload")
        return {"status": "error", "reason": "Missing installation_id"}

    token = get_installation_access_token(installation_id)
    token_source = "App JWT"

    if not token:
        logger.warning(f"[webhook] Failed to get installation token via App JWT, trying OAuth fallback for {repo_full_name}")
        # FALLBACK: Try to get the user's OAuth token
        try:
            inst = adapter.get_installation_by_id(installation_id)
            if inst and inst.get("user_id"):
                user_id = inst.get("user_id")
                # Look up user to get access_token
                # Note: adapter.get_user(user_id) might not exist, using supabase directly or assuming get_user exists
                response = adapter.supabase.table("users").select("access_token").eq("id", user_id).execute()
                if response.data:
                    token = response.data[0].get("access_token")
                    token_source = "OAuth Token"
                    logger.info(f"[webhook] Using OAuth fallback token for {repo_full_name}")
        except Exception as e:
            logger.error(f"[webhook] OAuth fallback failed: {e}")

    if not token:
        logger.error(f"[webhook] All token sources failed for {repo_full_name}")
        return {"status": "error", "reason": "Failed to get access token"}

    # Fetch the manifest file(s) from the repo
    # Prefer package-lock.json (richer dependency data) over package.json
    manifest_filename = None
    manifest_content = None

    for filename in ["package-lock.json", "package.json"]:
        if filename in trigger_files_found or manifest_content is None:
            content = _fetch_file_from_repo(repo_full_name, filename, default_branch, token)
            if content is not None:
                manifest_filename = filename
                manifest_content = content
                break

    if manifest_content is None:
        logger.error(f"[webhook] Could not fetch manifest from {repo_full_name}")
        return {"status": "error", "reason": "Could not fetch package.json or package-lock.json"}

    # ─── CALL THE EXISTING ANALYZER ───────────────────────────────────────
    # This is the critical integration point: we reuse analyze_manifest()
    # exactly as the /api/scan and /api/scan-file routes do.
    # No second scanner. Same pipeline, same scoring, same enrichment.
    # ──────────────────────────────────────────────────────────────────────
    try:
        logger.info(f"[webhook] Running analyzer on {manifest_filename} from {repo_full_name}")
        results = analyze_manifest(manifest_filename, manifest_content, usage_map=None)

        # Calculate summary metrics (same logic as the frontend)
        total = len(results)
        critical = sum(1 for d in results if d.get("sev") == "CRITICAL")
        high = sum(1 for d in results if d.get("sev") == "HIGH")
        medium = sum(1 for d in results if d.get("sev") == "MEDIUM")
        low = sum(1 for d in results if d.get("sev") == "LOW")
        safe_count = total - critical - high - medium - low

        # GPA-style health score (same formula as App.jsx)
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
            "trigger": "webhook",
            "manifest": manifest_filename,
        }

        # Save via adapter (teammate replaces with Supabase)
        adapter.save_scan_result(repo_full_name, scan_data)

        logger.info(
            f"[webhook] Scan complete for {repo_full_name}: "
            f"grade={grade}, total={total}, critical={critical}, high={high}"
        )

        return {
            "status": "scanned",
            "repo": repo_full_name,
            "grade": grade,
            "total_deps": total,
            "critical": critical,
            "high": high,
        }

    except Exception as e:
        logger.error(f"[webhook] Analyzer failed for {repo_full_name}: {e}")
        return {"status": "error", "reason": f"Analysis failed: {str(e)}"}


def _fetch_file_from_repo(
    repo_full_name: str, filename: str, branch: str, token: str
) -> dict | None:
    """
    Fetch a JSON file from a GitHub repository using the installation token.

    Uses the GitHub Contents API:
        GET /repos/{owner}/{repo}/contents/{path}?ref={branch}

    Args:
        repo_full_name: "owner/repo"
        filename: e.g. "package.json"
        branch: e.g. "main"
        token: Installation access token

    Returns:
        Parsed JSON content of the file, or None on failure
    """
    try:
        # Use GitHub API for direct file content (handles private repos and tokens correctly)
        api_url = f"{GITHUB_API_URL}/repos/{repo_full_name}/contents/{filename}?ref={branch}"

        response = requests.get(
            api_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
            timeout=15,
        )

        if response.status_code == 200:
            import base64
            data = response.json()
            content_base64 = data.get("content", "")
            content_bytes = base64.b64decode(content_base64)
            return json.loads(content_bytes.decode("utf-8"))

        logger.warning(
            f"[webhook] Failed to fetch {filename} from {repo_full_name}: "
            f"HTTP {response.status_code}"
        )
        return None

    except Exception as e:
        logger.warning(f"[webhook] Error fetching {filename} from {repo_full_name}: {e}")
        return None


# ─── INSTALLATION EVENT HANDLER ───────────────────────────────────────────────

def handle_installation_event(payload: dict) -> dict:
    """
    Process a GitHub App installation event.

    Fires when:
        - Someone installs the App on their account/org ("created")
        - Someone uninstalls the App ("deleted")
        - Someone changes repo selection ("added"/"removed")

    We save the installation_id and repo list via adapter so the
    monitoring dashboard can display connected repositories.

    Args:
        payload: Full webhook payload from GitHub

    Returns:
        {"status": "saved"/"ignored", ...}
    """
    action = payload.get("action", "")
    installation = payload.get("installation", {})
    installation_id = installation.get("id")
    account = installation.get("account", {})
    sender = payload.get("sender", {})

    if action == "created":
        # New installation — save it
        logger.info(
            f"[webhook] GitHub App installed by {account.get('login')} "
            f"(installation_id={installation_id})"
        )

        # Look up the user by their GitHub ID
        user = adapter.get_user_by_github_id(sender.get("id"))
        if user:
            adapter.save_installation(user["id"], {
                "installation_id": installation_id,
                "account_login": account.get("login", ""),
                "account_type": account.get("type", "User"),
            })

            # Save the initially selected repositories
            repos = payload.get("repositories", [])
            if repos:
                repo_records = [
                    {
                        "github_repo_id": r.get("id"),
                        "full_name": r.get("full_name", ""),
                        "private": r.get("private", False),
                        "default_branch": "main",  # GitHub doesn't include this in install event
                    }
                    for r in repos
                ]
                adapter.save_repositories(installation_id, repo_records)

        return {"status": "saved", "installation_id": installation_id, "repos": len(repos)}

    elif action == "deleted":
        logger.info(f"[webhook] GitHub App uninstalled: installation_id={installation_id}")
        # TODO: adapter.delete_installation(installation_id)
        return {"status": "uninstalled", "installation_id": installation_id}

    elif action in ("added", "removed"):
        # Repos were added or removed from an existing installation
        added = payload.get("repositories_added", [])
        removed = payload.get("repositories_removed", [])
        logger.info(
            f"[webhook] Repos changed for installation_id={installation_id}: "
            f"+{len(added)} -{len(removed)}"
        )

        if added:
            repo_records = [
                {
                    "github_repo_id": r.get("id"),
                    "full_name": r.get("full_name", ""),
                    "private": r.get("private", False),
                    "default_branch": "main",
                }
                for r in added
            ]
            adapter.save_repositories(installation_id, repo_records)

        if removed:
            adapter.remove_repositories(installation_id, [r["id"] for r in removed])

        return {"status": "updated", "added": len(added), "removed": len(removed)}

    else:
        logger.info(f"[webhook] Ignoring installation action: {action}")
        return {"status": "ignored", "action": action}


def handle_installation_repositories_event(payload: dict) -> dict:
    """
    Process 'installation_repositories' event (repo selection changes).

    This is separate from 'installation' event — it fires when an admin
    changes which repos the App can access after initial install.

    Args:
        payload: Full webhook payload from GitHub

    Returns:
        {"status": "updated", ...}
    """
    installation_id = payload.get("installation", {}).get("id")
    action = payload.get("action", "")

    added = payload.get("repositories_added", [])
    removed = payload.get("repositories_removed", [])

    logger.info(
        f"[webhook] installation_repositories event: "
        f"installation_id={installation_id}, action={action}, "
        f"+{len(added)} -{len(removed)}"
    )

    if added:
        repo_records = [
            {
                "github_repo_id": r.get("id"),
                "full_name": r.get("full_name", ""),
                "private": r.get("private", False),
                "default_branch": "main",
            }
            for r in added
        ]
        adapter.save_repositories(installation_id, repo_records)

    if removed:
        adapter.remove_repositories(installation_id, [r["id"] for r in removed])

    return {"status": "updated", "added": len(added), "removed": len(removed)}
