# backend/rag_client.py
import os
import hashlib
import json
import requests
from pinecone import Pinecone
from groq import Groq

# Cache for threat evaluations during a single scan session
THREAT_EVAL_CACHE = {}
REMEDIATION_CACHE = {}
AI_ANALYSIS_CACHE = {}
EMBED_CACHE = {}

def get_hf_token():
    return os.environ.get("HF_TOKEN", "")

def get_groq_key():
    return os.environ.get("GROQ_API_KEY", "")

# Using a free, high-speed embedding model from Hugging Face
EMBED_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"

def get_pc_index():
    api_key = os.environ.get("PINECONE_API_KEY")
    if not api_key:
        return None
    pc = Pinecone(api_key=api_key)
    INDEX_NAME = "depshield"
    try:
        index = pc.Index(INDEX_NAME)
        return index
    except Exception:
        return None

def embed(text: str) -> list[float]:
    """
    Generate 384-dimension embeddings via Hugging Face Inference API.
    Model: sentence-transformers/all-MiniLM-L6-v2 (Free)
    """
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in EMBED_CACHE:
        return EMBED_CACHE[cache_key]

    token = get_hf_token()
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": text[:1000]} # Truncate for efficiency

    for _ in range(3):
        try:
            r = requests.post(EMBED_URL, headers=headers, json=payload, timeout=20)
            if r.status_code == 503:
                import time; time.sleep(15); continue
            r.raise_for_status()
            data = r.json()
            res = data if isinstance(data[0], float) else data[0]
            EMBED_CACHE[cache_key] = res
            return res
        except Exception:
            continue
    return []

def upsert_cve(cve_id: str, description: str, cwes: list, score: float, package: str):
    """
    Call this whenever you enrich a new CVE.
    Stores in Pinecone (needs 384 dimensions).
    """
    index = get_pc_index()
    if not index:
        return
        
    vector = embed(description)
    if not vector:
        return

    vec_id = hashlib.md5(cve_id.encode()).hexdigest()
    index.upsert(vectors=[{
        "id": vec_id,
        "values": vector,
        "metadata": {
            "cve_id": cve_id,
            "description": description[:1000],
            "cwes": cwes,
            "cvss_score": score,
            "package": package,
        }
    }])

def query_similar_cves(description: str, package: str, top_k: int = 5) -> list[dict]:
    """
    Find the most semantically similar CVEs already in your index.
    """
    index = get_pc_index()
    if not index:
        return []

    query_text = f"Vulnerability in {package}: {description}"
    vector = embed(query_text)
    if not vector:
        return []

    results = index.query(vector=vector, top_k=top_k, include_metadata=True)
    return [m["metadata"] for m in results["matches"]]

def generate_remediation(
    package: str,
    version: str,
    cve_ids: list[str],
    description: str,
    score: float,
    similar_cves: list[dict],
    score_breakdown: dict,
) -> str:
    """
    Uses Groq (Llama 3.1) for fast, free remediation advice.
    """
    cache_key = f"{package}@{version}-{'-'.join(cve_ids)}"
    if cache_key in REMEDIATION_CACHE:
        return REMEDIATION_CACHE[cache_key]

    key = get_groq_key()
    if not key:
        return "Remediation advice unavailable (GROQ_API_KEY missing)."

    client = Groq(api_key=key, timeout=10.0)
    
    similar_text = "\n".join([
        f"- {c.get('cve_id')} ({c.get('package')}, CVSS {c.get('cvss_score')}): {c.get('description')[:200]}"
        for c in similar_cves[:3]
    ])
    
    prompt = f"""You are a security engineer advising a developer on a vulnerable npm dependency.

Package: {package}@{version}
Risk score: {score}/10
CVEs: {', '.join(cve_ids)}
Description: {description}
Score breakdown: {json.dumps(score_breakdown)}

Similar historical vulnerabilities for context:
{similar_text}

Provide:
1. A 2-sentence plain-English explanation of the actual risk
2. Exact fix command (npm install or patch)
3. Whether fix is safe (no breaking changes) or risky (major version bump)
4. One alternative package if the upgrade is very risky
Keep it under 120 words. Be concrete, not generic."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.2,
        )
        res = completion.choices[0].message.content
        REMEDIATION_CACHE[cache_key] = res
        return res
    except Exception as e:
        return f"AI Advisor failed: {str(e)}"

def upsert_threat(package: str, source: str, title: str, description: str, text: str, cves: list):
    """
    Store NER-extracted threat intelligence in Pinecone.
    """
    index = get_pc_index()
    if not index:
        return

    vector = embed(text)
    if not vector:
        return

    vec_id = hashlib.md5(f"threat-{package}-{source}-{title}".encode()).hexdigest()
    index.upsert(vectors=[{
        "id": vec_id,
        "values": vector,
        "metadata": {
            "type": "threat",
            "package": package,
            "source": source,
            "title": title,
            "description": description[:1000],
            "cves": cves
        }
    }])

def query_threats(package: str, top_k: int = 3) -> list[dict]:
    """
    Find threat intelligence related to a specific package.
    """
    index = get_pc_index()
    if not index:
        return []

    # Create a vector based on the package name to fulfill the query requirement
    query_text = f"Threat intelligence and security advisory for npm package {package}"
    vector = embed(query_text)
    if not vector:
        return []

    try:
        results = index.query(
            vector=vector, 
            top_k=top_k, 
            include_metadata=True,
            filter={"type": {"$eq": "threat"}, "package": {"$eq": package}}
        )
        return [m["metadata"] for m in results["matches"]]
    except Exception as e:
        print(f"Pinecone query_threats error: {e}")
        return []

def evaluate_threat_with_llm(package: str, threat_records: list[dict]) -> dict:
    """
    Uses Groq to determine if retrieved threat records indicate a real, active threat.
    Returns: {"is_threat": bool, "reason": str}
    """
    if package in THREAT_EVAL_CACHE:
        return THREAT_EVAL_CACHE[package]

    key = get_groq_key()
    if not key or not threat_records:
        return {"is_threat": False, "reason": "No threat intel available."}

    client = Groq(api_key=key, timeout=10.0)
    
    intel_text = "\n\n".join([
        f"Source: {t.get('source')}\nTitle: {t.get('title')}\nDescription: {t.get('description')}"
        for t in threat_records[:3]
    ])
    
    prompt = f"""You are a senior security engineer. You need to determine if an npm package is currently under an active supply chain attack or severe zero-day threat based on the latest threat intelligence.

Package: {package}

Recent Threat Intelligence:
{intel_text}

Is this package currently compromised or severely vulnerable based purely on this intelligence?
Provide your answer in strict JSON format:
{{
  "is_threat": true/false,
  "reason": "1-2 sentence explanation of the threat if true, or why it's not a severe active threat if false."
}}"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=200,
            temperature=0.1,
        )
        content = completion.choices[0].message.content
        res = json.loads(content)
        THREAT_EVAL_CACHE[package] = res
        return res
    except Exception as e:
        return {"is_threat": False, "reason": f"Failed to evaluate threat: {str(e)}"}
def generate_ai_analysis(package: str, cve_id: str, description: str) -> str:
    """
    Uses Groq to generate a plain-English security analysis.
    """
    if cve_id in AI_ANALYSIS_CACHE:
        return AI_ANALYSIS_CACHE[cve_id]

    key = get_groq_key()
    if not key:
        return ""

    client = Groq(api_key=key, timeout=8.0)
    prompt = f"""Summarize this security vulnerability for a developer.
Package: {package}
CVE: {cve_id}
Description: {description}

Provide a 2-sentence explanation:
1. What is the actual technical risk?
2. How can an attacker exploit it?
Keep it under 60 words. No jargon."""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.2,
        )
        res = completion.choices[0].message.content
        AI_ANALYSIS_CACHE[cve_id] = res
        return res
    except Exception:
        return ""
