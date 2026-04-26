"""
DepShield — Authentication Module

Handles:
  1. GitHub OAuth flow (user login)
     - Build authorization URL → redirect user to GitHub
     - Exchange authorization code for access token
     - Fetch GitHub user profile
  2. JWT token management
     - Create signed JWT with user data
     - Decode/validate JWT from request headers
     - @require_auth decorator for protected routes
  3. GitHub App authentication
     - Generate a JWT signed with the App's private key
     - Exchange App JWT for an installation access token
     - Installation tokens allow API access to repos the App is installed on

OAuth Flow Diagram:
  Browser → GET /api/auth/github → 302 to github.com/login/oauth/authorize
  GitHub → user approves → 302 back to /api/auth/github/callback?code=XXX
  Backend → POST github.com/login/oauth/access_token (exchange code)
  Backend → GET api.github.com/user (fetch profile)
  Backend → save_user() via adapter → create JWT → return to frontend
"""

import os
import time
import logging
import functools
import requests
import jwt  # PyJWT

from flask import request, jsonify

logger = logging.getLogger(__name__)

# ─── CONFIGURATION ─────────────────────────────────────────────────────────────

# GitHub OAuth App credentials (created at github.com/settings/applications/new)
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "").strip()

# GitHub App credentials (created at github.com/settings/apps/new)
GITHUB_APP_ID = os.environ.get("GITHUB_APP_ID", "")
GITHUB_APP_PRIVATE_KEY_PATH = os.environ.get("GITHUB_APP_PRIVATE_KEY_PATH", "")

# JWT signing secret for user session tokens
JWT_SECRET = os.environ.get("JWT_SECRET", "depshield-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# GitHub OAuth endpoints
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_URL = "https://api.github.com"


# ─── OAUTH FLOW ───────────────────────────────────────────────────────────────

def get_github_oauth_url(redirect_uri: str, state: str = "") -> str:
    """
    Build the GitHub OAuth authorization URL.

    The user's browser is redirected here to approve access.
    After approval, GitHub redirects back to redirect_uri with a ?code= parameter.

    Args:
        redirect_uri: Where GitHub sends the user after approval
                      (must match the OAuth App's callback URL setting)
        state: Optional CSRF token to verify the callback is legitimate

    Returns:
        Full GitHub authorization URL string
    """
    client_id = os.environ.get("GITHUB_CLIENT_ID", GITHUB_CLIENT_ID)
    
    if not client_id:
        logger.error("[auth] OAuth client ID loaded: no")
        raise ValueError("Backend error: GITHUB_CLIENT_ID is missing from environment variables.")
        
    logger.info("[auth] OAuth client ID loaded: yes")
    
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",  # Minimal scopes: read profile + email
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items() if v)
    return f"{GITHUB_AUTHORIZE_URL}?{query}"


def exchange_code_for_token(code: str) -> str | None:
    """
    Exchange the temporary authorization code for a long-lived access token.

    This is Step 2 of the OAuth flow:
      GitHub redirects user to our callback with ?code=XXX
      We POST this code + our client_secret to GitHub
      GitHub returns an access_token we can use for API calls

    Args:
        code: The authorization code from GitHub's redirect

    Returns:
        GitHub access token string, or None on failure
    """
    client_id = os.environ.get("GITHUB_CLIENT_ID", GITHUB_CLIENT_ID)
    client_secret = os.environ.get("GITHUB_CLIENT_SECRET", GITHUB_CLIENT_SECRET)
    
    if not client_id or not client_secret:
        logger.error("[auth] GitHub client ID or secret missing during token exchange")
        return None

    try:
        response = requests.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            logger.error(f"[auth] GitHub token exchange error: {data['error_description']}")
            return None

        return data.get("access_token")

    except Exception as e:
        logger.error(f"[auth] Failed to exchange code for token: {e}")
        return None


def fetch_github_user(access_token: str) -> dict | None:
    """
    Fetch the authenticated user's profile from GitHub API.

    Uses the access_token obtained from the OAuth flow.

    Returns:
        {
            "github_id": 12345,
            "login": "octocat",
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
            "name": "The Octocat",
            "email": "octocat@github.com"
        }
        or None on failure
    """
    try:
        response = requests.get(
            f"{GITHUB_API_URL}/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()

        return {
            "github_id": data["id"],
            "login": data["login"],
            "avatar_url": data.get("avatar_url", ""),
            "name": data.get("name", data["login"]),
            "email": data.get("email", ""),
        }

    except Exception as e:
        logger.error(f"[auth] Failed to fetch GitHub user: {e}")
        return None


# ─── JWT TOKEN MANAGEMENT ─────────────────────────────────────────────────────

def create_jwt(user_data: dict) -> str:
    """
    Create a signed JWT containing user identity.

    The frontend stores this token and sends it in Authorization headers.
    Backend validates it on protected routes.

    Payload includes:
        sub: internal user ID
        github_id: GitHub user ID
        login: GitHub username
        avatar_url: profile picture
        exp: expiration timestamp

    Args:
        user_data: User record from db_adapter.save_user()

    Returns:
        Signed JWT string
    """
    payload = {
        "sub": user_data["id"],
        "github_id": user_data["github_id"],
        "login": user_data["login"],
        "avatar_url": user_data.get("avatar_url", ""),
        "name": user_data.get("name", user_data["login"]),
        "iat": int(time.time()),
        "exp": int(time.time()) + (JWT_EXPIRY_HOURS * 3600),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> dict | None:
    """
    Verify and decode a JWT token.

    Checks signature and expiration.

    Returns:
        Decoded payload dict, or None if invalid/expired
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        logger.warning("[auth] JWT expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"[auth] Invalid JWT: {e}")
        return None


def require_auth(f):
    """
    Flask route decorator that requires a valid JWT.

    Extracts the token from the Authorization header:
        Authorization: Bearer <token>

    On success: sets request.user to the decoded JWT payload
    On failure: returns 401 JSON response

    Usage:
        @app.route("/api/protected")
        @require_auth
        def protected_route():
            user = request.user  # decoded JWT payload
            return jsonify({"hello": user["login"]})
    """
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header[7:]  # Strip "Bearer " prefix
        payload = decode_jwt(token)

        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        # Attach decoded user data to the request for downstream handlers
        request.user = payload
        return f(*args, **kwargs)

    return decorated


# ─── GITHUB APP AUTHENTICATION ────────────────────────────────────────────────
# GitHub Apps authenticate differently from OAuth Apps:
#   1. Generate a JWT signed with the App's RSA private key
#   2. Exchange that JWT for a short-lived installation access token
#   3. Use the installation token to make API calls on behalf of the installed repos
#
# This is needed for:
#   - Fetching files from repos the App is installed on (e.g. package.json)
#   - Responding to webhook events with API calls
# ──────────────────────────────────────────────────────────────────────────────

def _load_private_key() -> str | None:
    """
    Load the GitHub App's RSA private key from the filesystem.

    The private key is a .pem file downloaded when creating the GitHub App.
    It MUST NOT be committed to version control (listed in .gitignore).

    Returns:
        PEM-encoded private key string, or None if not found
    """
    key_path = GITHUB_APP_PRIVATE_KEY_PATH
    if not key_path:
        logger.warning("[auth] GITHUB_APP_PRIVATE_KEY_PATH not set")
        return None
    try:
        with open(key_path, "r") as f:
            return f.read()
    except FileNotFoundError:
        logger.warning(f"[auth] Private key file not found: {key_path}")
        return None
    except Exception as e:
        logger.error(f"[auth] Failed to load private key: {e}")
        return None


def create_github_app_jwt() -> str | None:
    """
    Create a JWT for authenticating as the GitHub App itself.

    This JWT is signed with the App's RSA private key (RS256 algorithm).
    It's short-lived (max 10 minutes per GitHub's requirements).

    The App JWT is NOT used directly for API calls — it's exchanged
    for an installation access token (see get_installation_access_token).

    Returns:
        RS256-signed JWT string, or None if private key unavailable
    """
    private_key = _load_private_key()
    if not private_key or not GITHUB_APP_ID:
        return None

    now = int(time.time())
    payload = {
        "iat": now - 60,        # Issued at: 60 seconds in the past (clock skew buffer)
        "exp": now + (9 * 60),  # Expires: 9 minutes from now (max 10 min)
        "iss": GITHUB_APP_ID,   # Issuer: the GitHub App ID
    }

    try:
        return jwt.encode(payload, private_key, algorithm="RS256")
    except Exception as e:
        logger.error(f"[auth] Failed to create GitHub App JWT: {e}")
        return None


def get_installation_access_token(installation_id: int) -> str | None:
    """
    Exchange a GitHub App JWT for an installation access token.

    Installation tokens allow API access to the specific repositories
    where the GitHub App has been installed. They expire after 1 hour.

    Flow:
        1. Create an App JWT (signed with private key)
        2. POST to GitHub API with the App JWT
        3. GitHub returns a short-lived installation token

    Args:
        installation_id: The GitHub App installation ID
                         (received via webhook or install flow)

    Returns:
        Installation access token string, or None on failure
    """
    app_jwt = create_github_app_jwt()
    if not app_jwt:
        logger.error("[auth] Cannot get installation token: App JWT creation failed")
        return None

    try:
        response = requests.post(
            f"{GITHUB_API_URL}/app/installations/{installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        token = data.get("token")
        expires_at = data.get("expires_at")
        logger.info(
            f"[auth] Got installation token for installation_id={installation_id}, "
            f"expires={expires_at}"
        )
        return token

    except Exception as e:
        logger.error(f"[auth] Failed to get installation access token: {e}")
        return None
