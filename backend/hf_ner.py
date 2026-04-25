import os, re, requests

HF_TOKEN = os.environ.get("HF_TOKEN", "")
NER_URL = "https://api-inference.huggingface.co/models/dslim/bert-base-NER"

def _hf_post(url: str, payload: dict) -> dict:
    """Single HF Inference API caller with cold-start retry."""
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    for attempt in range(3):
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        if r.status_code == 503:          # model loading (cold start)
            import time; time.sleep(20)
            continue
        r.raise_for_status()
        return r.json()
    raise RuntimeError("HF API unavailable after 3 retries")

def extract_security_entities(text: str) -> dict:
    """
    Pull package names, CVE IDs, and version numbers from any
    free-text threat intel input (security blog, GitHub issue,
    npm audit output, Hacker News comment, etc.)

    Returns:
      {
        "packages": ["axios", "lodash"],
        "cves":     ["CVE-2026-40175", "GHSA-1234-5678-abcd"],
        "versions": ["1.14.1", "0.30.4"],
        "orgs":     ["Elastic Security Labs"]
      }
    """
    if not text:
        return {"packages": [], "cves": [], "versions": [], "orgs": []}

    # Truncate — BERT has 512 token limit
    chunk = text[:1800]
    try:
        raw = _hf_post(NER_URL, {"inputs": chunk})
    except Exception:
        raw = []

    packages, orgs, versions = [], [], []

    # Regex pass for CVEs and GHSA IDs (NER misses them — they look like misc)
    cves = list(set(re.findall(r"CVE-\d{4}-\d+", text, re.IGNORECASE)
                  + re.findall(r"GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}", text, re.IGNORECASE)))

    # Regex pass for semver versions
    versions = list(set(re.findall(r"\b\d+\.\d+\.\d+(?:-\w+)?\b", text)))

    # NER pass for org names (package publishers, researchers, vendors)
    if isinstance(raw, list):
        current_word, current_type = [], None
        for tok in raw:
            entity = tok.get("entity", "")
            word   = tok.get("word", "").replace("##", "")
            if entity.startswith("B-"):
                if current_word and current_type == "ORG":
                    orgs.append("".join(current_word))
                current_word = [word]
                current_type = entity[2:]
            elif entity.startswith("I-") and current_type:
                current_word.append(word)
            else:
                if current_word and current_type == "ORG":
                    orgs.append("".join(current_word))
                current_word, current_type = [], None

        # Last one
        if current_word and current_type == "ORG":
            orgs.append("".join(current_word))

        # npm package names look like MISC entities — collect them
        packages = [t["word"].replace("##","") for t in raw
                    if t.get("entity","").endswith("MISC")
                    and re.match(r"^[@a-z][\w\-/]+$", t.get("word",""))]

    return {
        "packages": list(set(packages)),
        "cves":     cves,
        "versions": list(set(versions)),
        "orgs":     list(set(orgs)),
    }
