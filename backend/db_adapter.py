"""
DepShield — Database Adapter Layer (Placeholder)

This module provides a clean interface between the application logic
(OAuth, GitHub App, webhooks) and the persistence layer.

CURRENT STATE: In-memory dictionaries for development/demo.
TODO: Teammate replaces each function body with Supabase client calls.

CONTRACT:
  - Every function has typed inputs and documented return shapes.
  - The rest of the codebase imports ONLY from this module.
  - Swapping to Supabase = changing function bodies here, nothing else.
"""

import time
import uuid
import logging

logger = logging.getLogger(__name__)

# ─── IN-MEMORY STORES (temporary — replaced by Supabase) ──────────────────────
_users = {}              # keyed by github_id
_installations = {}      # keyed by user_id
_repositories = {}       # keyed by installation_id -> list of repos
_scan_results = {}       # keyed by repo full_name -> list of scans
_webhook_events = []     # append-only log


# ─── USER FUNCTIONS ────────────────────────────────────────────────────────────

def save_user(user_data: dict) -> dict:
    """
    Save or update a GitHub user after OAuth login.

    Input:
        {
            "github_id": 12345,
            "login": "octocat",
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
            "access_token": "gho_xxxxxxxxxxxx"
        }

    Returns:
        {"id": "internal-uuid", "github_id": 12345, "login": "octocat", ...}

    TODO: Replace with Supabase — upsert into 'users' table on github_id.
    """
    github_id = user_data["github_id"]

    if github_id in _users:
        # Update existing user
        _users[github_id].update(user_data)
        _users[github_id]["last_login"] = time.time()
        logger.info(f"[db_adapter] Updated user: {user_data['login']} (github_id={github_id})")
    else:
        # Create new user
        _users[github_id] = {
            "id": str(uuid.uuid4()),
            **user_data,
            "created_at": time.time(),
            "last_login": time.time(),
        }
        logger.info(f"[db_adapter] Created user: {user_data['login']} (github_id={github_id})")

    return _users[github_id]


def get_user_by_github_id(github_id: int) -> dict | None:
    """
    Fetch a user by their GitHub user ID.

    Returns None if the user doesn't exist.

    TODO: Replace with Supabase — SELECT * FROM users WHERE github_id = ?
    """
    return _users.get(github_id)


# ─── INSTALLATION FUNCTIONS ───────────────────────────────────────────────────

def save_installation(user_id: str, installation_data: dict) -> dict:
    """
    Save a GitHub App installation linked to a user.

    Input:
        user_id: internal user UUID
        installation_data: {
            "installation_id": 67890,
            "account_login": "octocat",
            "account_type": "User"   # or "Organization"
        }

    Returns:
        The saved installation record.

    TODO: Replace with Supabase — upsert into 'github_installations' table.
    """
    record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        **installation_data,
        "created_at": time.time(),
    }
    _installations[user_id] = record
    logger.info(
        f"[db_adapter] Saved installation: installation_id={installation_data['installation_id']} "
        f"for user_id={user_id}"
    )
    return record


def get_user_installation(user_id: str) -> dict | None:
    """
    Get the GitHub App installation for a user.

    Returns None if no installation exists.

    TODO: Replace with Supabase — SELECT * FROM github_installations WHERE user_id = ?
    """
    return _installations.get(user_id)


def get_installation_by_id(installation_id: int) -> dict | None:
    """
    Look up an installation by its GitHub installation_id.

    Used by webhook handler to find which user owns this installation.

    TODO: Replace with Supabase — SELECT * FROM github_installations WHERE installation_id = ?
    """
    for inst in _installations.values():
        if inst.get("installation_id") == installation_id:
            return inst
    return None


# ─── REPOSITORY FUNCTIONS ─────────────────────────────────────────────────────

def save_repositories(installation_id: int, repos: list[dict]) -> list[dict]:
    """
    Save/sync repositories from a GitHub App installation.

    Input:
        installation_id: GitHub installation ID
        repos: [
            {
                "github_repo_id": 111,
                "full_name": "owner/repo",
                "default_branch": "main",
                "private": False
            },
            ...
        ]

    Returns:
        The saved list of repository records.

    TODO: Replace with Supabase — upsert into 'repositories' table,
          keyed on (installation_id, github_repo_id).
    """
    saved = []
    for repo in repos:
        record = {
            "id": str(uuid.uuid4()),
            "installation_id": installation_id,
            **repo,
            "last_scan_at": None,
            "last_scan_grade": None,
            "created_at": time.time(),
        }
        saved.append(record)

    _repositories[installation_id] = saved
    logger.info(
        f"[db_adapter] Saved {len(repos)} repositories for installation_id={installation_id}"
    )
    return saved


def get_user_repositories(user_id: str) -> list[dict]:
    """
    Get all monitored repositories for a user.

    Joins through installations to find repos.

    Returns empty list if no repos connected.

    TODO: Replace with Supabase — JOIN github_installations + repositories WHERE user_id = ?
    """
    installation = _installations.get(user_id)
    if not installation:
        return []
    inst_id = installation.get("installation_id")
    return _repositories.get(inst_id, [])


def get_repo_by_full_name(full_name: str) -> dict | None:
    """
    Find a repository record by its full_name (e.g. "owner/repo").

    Used by webhook handler to match incoming push events to monitored repos.

    TODO: Replace with Supabase — SELECT * FROM repositories WHERE full_name = ?
    """
    for repos in _repositories.values():
        for repo in repos:
            if repo.get("full_name") == full_name:
                return repo
    return None


# ─── SCAN RESULT FUNCTIONS ────────────────────────────────────────────────────

def save_scan_result(repo_full_name: str, scan_data: dict) -> dict:
    """
    Save a scan result from a webhook-triggered or manual analysis.

    Input:
        repo_full_name: "owner/repo"
        scan_data: {
            "grade": "B",
            "risk_score": 72,
            "total_deps": 45,
            "critical": 2,
            "high": 5,
            "results": [...],       # Full analyzer output (list of dep objects)
            "scanned_at": "2026-04-25T18:00:00Z",
            "trigger": "webhook"    # or "manual"
        }

    Returns:
        The saved scan record with an auto-generated ID.

    TODO: Replace with Supabase — INSERT into 'scan_results' table.
          Also update repositories.last_scan_at and repositories.last_scan_grade.
    """
    record = {
        "id": str(uuid.uuid4()),
        "repo_full_name": repo_full_name,
        **scan_data,
        "saved_at": time.time(),
    }

    if repo_full_name not in _scan_results:
        _scan_results[repo_full_name] = []
    _scan_results[repo_full_name].append(record)

    # Also update repo's last_scan fields
    repo = get_repo_by_full_name(repo_full_name)
    if repo:
        repo["last_scan_at"] = scan_data.get("scanned_at")
        repo["last_scan_grade"] = scan_data.get("grade")

    logger.info(
        f"[db_adapter] Saved scan result for {repo_full_name}: "
        f"grade={scan_data.get('grade')}, deps={scan_data.get('total_deps')}"
    )
    return record


def get_scan_results(repo_full_name: str, limit: int = 10) -> list[dict]:
    """
    Get recent scan results for a repository, newest first.

    TODO: Replace with Supabase — SELECT * FROM scan_results
          WHERE repo_full_name = ? ORDER BY scanned_at DESC LIMIT ?
    """
    results = _scan_results.get(repo_full_name, [])
    return sorted(results, key=lambda r: r.get("saved_at", 0), reverse=True)[:limit]


# ─── WEBHOOK EVENT LOG ────────────────────────────────────────────────────────

def save_webhook_event(event_data: dict) -> None:
    """
    Log a raw webhook event for debugging/auditing.

    Input:
        {
            "event_type": "push",
            "delivery_id": "abc-123",
            "repository": "owner/repo",
            "payload_summary": "...",
            "received_at": "2026-04-25T18:00:00Z"
        }

    TODO: Replace with Supabase — INSERT into 'webhook_events' table.
          This is optional in production; useful for debugging.
    """
    _webhook_events.append({
        "id": str(uuid.uuid4()),
        **event_data,
        "logged_at": time.time(),
    })
    logger.info(
        f"[db_adapter] Logged webhook event: {event_data.get('event_type')} "
        f"from {event_data.get('repository', 'unknown')}"
    )
