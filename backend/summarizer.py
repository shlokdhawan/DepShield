import os, requests, hashlib

HF_TOKEN = os.environ.get("HF_TOKEN", "")
SUMM_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"

SUMM_CACHE = {}   # { hash(desc): plain_english }

# Prompt template — prepended to the raw description before summarizing.
# bart-large-cnn is a summarizer not a chat model, so the "prompt" is
# just context prepended to the text. It follows the style of the input.
SECURITY_PREAMBLE = (
    "Security vulnerability report for a software developer. "
    "Explain in plain English what this vulnerability means, "
    "what an attacker could do, and what version fixes it. "
    "Be specific and avoid jargon. "
    "Vulnerability description: "
)

def plain_english_summary(
    cve_id: str,
    raw_description: str,
    package: str,
    fixed_version: str | None = None,
) -> str:
    """
    Takes a raw CVE/OSV description and returns a 2-sentence plain-English
    summary a non-security developer can understand and act on.

    Example input (NVD prose):
      "A Server-Side Request Forgery (SSRF) vulnerability in axios prior to
       1.15.0 allows attackers to bypass NO_PROXY matching via hostname
       normalization of loopback addresses (CVE-2025-62718)."

    Example output:
      "This axios bug lets attackers trick your server into making requests
       to internal services (like AWS metadata) that should be off-limits.
       Upgrade to axios 1.15.0 or later to fix it."
    """
    cache_key = hashlib.md5((cve_id + raw_description).encode()).hexdigest()
    if cache_key in SUMM_CACHE:
        return SUMM_CACHE[cache_key]

    fix_hint = f" The fix is available in version {fixed_version}." if fixed_version else ""
    input_text = SECURITY_PREAMBLE + raw_description[:900] + fix_hint

    import re
    def clean_markdown(text):
        text = re.sub(r'#+\s*', '', text)
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        text = re.sub(r'__(.*?)__', r'\1', text)
        text = re.sub(r'`(.*?)`', r'\1', text)
        text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
        return text.strip()

    clean_raw = clean_markdown(raw_description)
    fallback = clean_raw

    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    for _ in range(2):
        try:
            r = requests.post(SUMM_URL, headers=headers, json={
                "inputs": input_text,
                "parameters": {
                    "max_length": 80,
                    "min_length": 30,
                    "do_sample": False,
                }
            }, timeout=5)
            if r.status_code == 503:
                import time; time.sleep(2); continue
            r.raise_for_status()
            data = r.json()
            summary = data[0]["summary_text"] if isinstance(data, list) else fallback
            SUMM_CACHE[cache_key] = summary
            return summary
        except Exception:
            continue

    return fallback   # graceful fallback

def batch_summarize(vulns: list[dict], package: str) -> list[dict]:
    """
    Summarize a list of vuln dicts in-place.
    Only runs for HIGH/CRITICAL to keep API usage low.
    """
    for v in vulns:
        severity = v.get("severity", "LOW")
        if severity in ("CRITICAL", "HIGH") and v.get("summary"):
            # Note: The field name in analyzer.py result is "summary" not "desc" at this point
            v["plain_desc"] = plain_english_summary(
                cve_id=v.get("id", ""),
                raw_description=v["summary"],
                package=package,
                fixed_version=v.get("fixed_version"),
            )
    return vulns
