import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Ensure env vars are loaded from the root .env file
# Depending on where the script is run, we look up to the root folder
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
load_dotenv(dotenv_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("[supabase_client] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
    raise ValueError("Missing Supabase credentials in .env file. Please add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

# Create the Supabase client
# Security Note: This uses the service role key and bypasses Row Level Security.
# It should ONLY be used in the secure backend context. Never expose this key to the frontend.
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
except Exception as e:
    logger.error(f"[supabase_client] Failed to initialize Supabase client: {str(e)}")
    raise
