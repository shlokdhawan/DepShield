"""
DepShield — Database Adapter Layer

This module provides the interface between the application logic and Supabase.
"""

import time
import uuid
import logging
import datetime

try:
    from .supabase_client import supabase
except ImportError:
    from supabase_client import supabase

logger = logging.getLogger(__name__)

# ─── USER FUNCTIONS ────────────────────────────────────────────────────────────

def save_user(user_data: dict) -> dict:
    """
    Save or update a GitHub user after OAuth login.
    """
    github_id = user_data.get("github_id")
    if not github_id:
        return {"error": "Missing github_id"}

    try:
        # Upsert user based on github_id (unique constraint)
        record = {
            "github_id": github_id,
            "login": user_data.get("login"),
            "name": user_data.get("name"),
            "email": user_data.get("email"),
            "avatar_url": user_data.get("avatar_url"),
            "access_token": user_data.get("access_token"),
            "last_login": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        # Check if user exists first to get internal ID or just let upsert handle it
        # The schema has a unique constraint on github_id
        response = supabase.table("users").upsert(record, on_conflict="github_id").execute()
        if not response.data:
            return {"error": "Failed to save user"}
        
        logger.info(f"[db_adapter] Saved user: {user_data.get('login')} (github_id={github_id})")
        return response.data[0]
    except Exception as e:
        print(f"[db_adapter] Error saving user exception details: {str(e)}")
        logger.error(f"[db_adapter] Error saving user: Database operation failed")
        return {"error": str(e)}


def get_user_by_github_id(github_id: int) -> dict | None:
    """
    Fetch a user by their GitHub user ID.
    """
    try:
        response = supabase.table("users").select("*").eq("github_id", github_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching user by github_id: Database operation failed")
        return None


# ─── INSTALLATION FUNCTIONS ───────────────────────────────────────────────────

def save_installation(user_id: str, installation_data: dict) -> dict:
    """
    Save a GitHub App installation linked to a user.
    """
    try:
        record = {
            "user_id": user_id,
            "installation_id": installation_data.get("installation_id"),
            "account_login": installation_data.get("account_login"),
            "account_type": installation_data.get("account_type"),
        }
        response = supabase.table("github_installations").upsert(record, on_conflict="installation_id").execute()
        
        logger.info(f"[db_adapter] Saved installation: {installation_data.get('installation_id')} for user_id={user_id}")
        return response.data[0] if response.data else {"error": "Failed to save installation"}
    except Exception as e:
        logger.error(f"[db_adapter] Error saving installation: Database operation failed")
        return {"error": "Database error"}


def get_user_installation(user_id: str) -> dict | None:
    """
    Get the GitHub App installation for a user.
    """
    try:
        response = supabase.table("github_installations").select("*").eq("user_id", user_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching user installation: Database operation failed")
        return None


def get_installation_by_id(installation_id: int) -> dict | None:
    """
    Look up an installation by its GitHub installation_id.
    """
    try:
        response = supabase.table("github_installations").select("*").eq("installation_id", installation_id).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching installation by ID: Database operation failed")
        return None


# ─── REPOSITORY FUNCTIONS ─────────────────────────────────────────────────────

def save_repositories(installation_id: int = None, repos: list[dict] = None, user_id: str = None, **kwargs) -> list[dict]:
    """
    Save/sync repositories from a GitHub App installation.
    Supports backward compatibility (installation_id, repos) and new signature.
    """
    if repos is None and "repos" in kwargs:
        repos = kwargs["repos"]
    
    # If user_id is missing, try to resolve it from the installation
    if not user_id and installation_id:
        inst = get_installation_by_id(installation_id)
        if inst:
            user_id = inst.get("user_id")

    if not repos:
        return []

    saved = []
    try:
        records = []
        for repo in repos:
            # Handle backward compatible keys (full_name, private, default_branch)
            full_name = repo.get("full_name", "")
            parts = full_name.split("/")
            owner = parts[0] if len(parts) > 1 else ""
            name = parts[1] if len(parts) > 1 else full_name
            
            record = {
                "installation_id": installation_id,
                "github_repo_id": repo.get("github_repo_id"),
                "full_name": full_name,
                "name": repo.get("name", name),
                "owner": repo.get("owner", owner),
                "default_branch": repo.get("default_branch"),
                "private": repo.get("private"),
                "enabled": repo.get("enabled", True),
            }
            if user_id:
                record["user_id"] = user_id
                
            records.append(record)
            
        # Bulk upsert based on github_repo_id
        response = supabase.table("repositories").upsert(records, on_conflict="github_repo_id").execute()
        if response.data:
            saved = response.data
            
        logger.info(f"[db_adapter] Saved {len(saved)} repositories for installation_id={installation_id}")
        return saved
    except Exception as e:
        print(f"[db_adapter] Error saving repositories exception details: {str(e)}")
        logger.error(f"[db_adapter] Error saving repositories: Database operation failed")
        return []

def remove_repositories(installation_id: int, github_repo_ids: list[int]) -> bool:
    """
    Remove repositories from the database by their GitHub IDs for a specific installation.
    """
    if not github_repo_ids:
        return True
    try:
        response = supabase.table("repositories").delete().eq("installation_id", installation_id).in_("github_repo_id", github_repo_ids).execute()
        logger.info(f"[db_adapter] Removed {len(github_repo_ids)} repositories for installation_id={installation_id}")
        return True
    except Exception as e:
        logger.error(f"[db_adapter] Error removing repositories: {str(e)}")
        return False


def get_user_repositories(user_id: str) -> list[dict]:
    """
    Get all monitored repositories for a user.
    """
    try:
        response = supabase.table("repositories").select("*").eq("user_id", user_id).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching user repositories: Database operation failed")
        return []


def get_repo_by_full_name(full_name: str) -> dict | None:
    """
    Find a repository record by its full_name.
    """
    try:
        response = supabase.table("repositories").select("*").eq("full_name", full_name).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching repo by full name: Database operation failed")
        return None


# ─── SCAN RESULT FUNCTIONS ────────────────────────────────────────────────────

def save_scan_result(repo_full_name: str, scan_data: dict, commit_sha: str = None, commit_timestamp: str = None, triggered_by: str = "webhook", user_id: str = None, **kwargs) -> dict:
    """
    Save a scan result from a webhook-triggered or manual analysis.
    """
    try:
        record = {
            "repo_full_name": repo_full_name,
            "commit_sha": commit_sha,
            "commit_timestamp": commit_timestamp,
            "triggered_by": triggered_by,
            "grade": scan_data.get("grade"),
            "risk_score": scan_data.get("risk_score"),
            "total_deps": scan_data.get("total_deps"),
            "critical": scan_data.get("critical"),
            "high": scan_data.get("high"),
            "result_json": scan_data.get("results", []), # store the actual vulnerability data
        }
        
        # If scanned_at is provided, map it to created_at or explicitly if added to schema
        if scan_data.get("scanned_at"):
            pass # created_at handles this natively by default

        response = supabase.table("scan_results").insert(record).execute()
        
        # Update repo metadata
        try:
            repo_update = {
                "last_scan_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "last_scan_grade": scan_data.get("grade")
            }
            supabase.table("repositories").update(repo_update).eq("full_name", repo_full_name).execute()
        except Exception as update_err:
            logger.warning("[db_adapter] Could not update repository metadata after scan")

        logger.info(f"[db_adapter] Saved scan result for {repo_full_name}")
        return response.data[0] if response.data else {"error": "Failed to save scan"}
    except Exception as e:
        logger.error(f"[db_adapter] Error saving scan result: Database operation failed")
        return {"error": "Database error"}


def get_previous_scan(repo_full_name: str) -> dict | None:
    """
    Get the most recent previous scan for a repository.
    """
    try:
        response = supabase.table("scan_results").select("*").eq("repo_full_name", repo_full_name).order("created_at", desc=True).limit(1).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching previous scan: Database operation failed")
        return None


def get_scan_results(repo_full_name: str, limit: int = 10) -> list[dict]:
    """
    Get recent scan results for a repository, newest first.
    """
    try:
        # We also need to map result_json back to 'results' for backward compatibility
        response = supabase.table("scan_results").select("*").eq("repo_full_name", repo_full_name).order("created_at", desc=True).limit(limit).execute()
        if not response.data:
            return []
            
        results = []
        for row in response.data:
            row["results"] = row.get("result_json", [])
            row["scanned_at"] = row.get("created_at") # map created_at back to scanned_at
            results.append(row)
            
        return results
    except Exception as e:
        logger.error(f"[db_adapter] Error fetching scan results: Database operation failed")
        return []


# ─── WEBHOOK EVENT LOG ────────────────────────────────────────────────────────

def save_webhook_event(event_data: dict) -> None:
    """
    Log a raw webhook event for debugging/auditing.
    """
    try:
        record = {
            "event_type": event_data.get("event_type"),
            "delivery_id": event_data.get("delivery_id"),
            "repository": event_data.get("repository"),
            "payload_summary": event_data.get("payload_summary"),
        }
        supabase.table("webhook_events").insert(record).execute()
        logger.info(f"[db_adapter] Logged webhook event from {event_data.get('repository', 'unknown')}")
    except Exception as e:
        logger.error(f"[db_adapter] Error saving webhook event: Database operation failed")
