# backend/rag_client.py
import os
import hashlib
import json
import requests
from pinecone import Pinecone
from groq import Groq

# Cache files for persistence
CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def load_cache(name):
    path = os.path.join(CACHE_DIR, f"{name}.json")
    if os.path.exists(path):
        try:
            with open(path, "r") as f: return json.load(f)
        except: return {}
    return {}

def save_cache(name, data):
    path = os.path.join(CACHE_DIR, f"{name}.json")
    try:
        with open(path, "w") as f: json.dump(data, f)
    except: pass

# Caches
THREAT_EVAL_CACHE = load_cache("threat_eval")
REMEDIATION_CACHE = load_cache("remediation")
AI_ANALYSIS_CACHE = load_cache("ai_analysis")
EMBED_CACHE = load_cache("embed")

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
    """Generate 384-dimension embeddings via Hugging Face Inference API."""
    cache_key = hashlib.md5(text.encode()).hexdigest()
    if cache_key in EMBED_CACHE:
        return EMBED_CACHE[cache_key]

    token = get_hf_token()
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}"}
    payload = {"inputs": text[:1000]}

    for _ in range(3):
        try:
            r = requests.post(EMBED_URL, headers=headers, json=payload, timeout=20)
            if r.status_code == 503:
                import time; time.sleep(15); continue
            r.raise_for_status()
            data = r.json()
            res = data if isinstance(data[0], float) else data[0]
            EMBED_CACHE[cache_key] = res
            save_cache("embed", EMBED_CACHE)
            return res
        except Exception:
            continue
    return []

def upsert_cve(cve_id: str, description: str, cwes: list, score: float, package: str):
    """Stores CVE info in Pinecone."""
    index = get_pc_index()
    if not index: return
    vector = embed(description)
    if not vector: return
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
    """Finds semantically similar CVEs."""
    index = get_pc_index()
    if not index: return []
    query_text = f"Vulnerability in {package}: {description}"
    vector = embed(query_text)
    if not vector: return []
    try:
        results = index.query(vector=vector, top_k=top_k, include_metadata=True)
        return [m["metadata"] for m in results["matches"]]
    except: return []

def generate_remediation(package, version, cve_ids, description, score, similar_cves, score_breakdown):
    """Uses Groq for remediation advice."""
    cache_key = f"{package}@{version}-{'-'.join(cve_ids)}"
    if cache_key in REMEDIATION_CACHE: return REMEDIATION_CACHE[cache_key]
    key = get_groq_key()
    if not key: return "Remediation advice unavailable (GROQ_API_KEY missing)."
    client = Groq(api_key=key, timeout=10.0)
    similar_text = "\n".join([f"- {c.get('cve_id')}: {c.get('description')[:150]}" for c in similar_cves[:3]])
    prompt = f"""Engineer advice for {package}@{version}. Score: {score}/10. CVEs: {', '.join(cve_ids)}. Desc: {description}.
    Similar: {similar_text}
    Provide: 1. Risk explanation (2 sentences), 2. Fix command, 3. Safety assessment, 4. Alternative. Max 120 words."""
    try:
        completion = client.chat.completions.create(model="llama-3.1-8b-instant", messages=[{"role": "user", "content": prompt}], max_tokens=300)
        res = completion.choices[0].message.content
        REMEDIATION_CACHE[cache_key] = res
        save_cache("remediation", REMEDIATION_CACHE)
        return res
    except Exception as e:
        if "429" in str(e): return "AI Advisor is busy (Rate Limit). Cached result used if available."
        return f"AI Advisor failed: {str(e)}"

def upsert_threat(package, source, title, description, text, cves):
    """Stores threat intel in Pinecone."""
    index = get_pc_index()
    if not index: return
    vector = embed(text)
    if not vector: return
    vec_id = hashlib.md5(f"threat-{package}-{source}-{title}".encode()).hexdigest()
    index.upsert(vectors=[{"id": vec_id, "values": vector, "metadata": {"type": "threat", "package": package, "source": source, "title": title, "description": description[:1000], "cves": cves}}])

def query_threats(package, top_k=3):
    """Finds threats for a package."""
    index = get_pc_index()
    if not index: return []
    vector = embed(f"Threat for npm package {package}")
    if not vector: return []
    try:
        results = index.query(vector=vector, top_k=top_k, include_metadata=True, filter={"type": {"$eq": "threat"}, "package": {"$eq": package}})
        return [m["metadata"] for m in results["matches"]]
    except: return []

def evaluate_threat_with_llm(package, threat_records):
    """Determines if threat is active."""
    if package in THREAT_EVAL_CACHE: return THREAT_EVAL_CACHE[package]
    key = get_groq_key()
    if not key or not threat_records: return {"is_threat": False, "reason": "No intel."}
    client = Groq(api_key=key, timeout=10.0)
    intel = "\n".join([f"{t.get('title')}: {t.get('description')}" for t in threat_records[:3]])
    prompt = f"Is {package} compromised? Intel: {intel}. Answer in JSON: {{'is_threat': bool, 'reason': str}}"
    try:
        completion = client.chat.completions.create(model="llama-3.1-8b-instant", messages=[{"role": "user", "content": prompt}], response_format={"type": "json_object"})
        res = json.loads(completion.choices[0].message.content)
        THREAT_EVAL_CACHE[package] = res
        save_cache("threat_eval", THREAT_EVAL_CACHE)
        return res
    except: return {"is_threat": False, "reason": "Error evaluating threat."}

def generate_ai_analysis(package, cve_id, description):
    """Generates detailed technical analysis."""
    if cve_id in AI_ANALYSIS_CACHE: return AI_ANALYSIS_CACHE[cve_id]
    key = get_groq_key()
    if not key: return description
    client = Groq(api_key=key, timeout=8.0)
    prompt = f"""Technical analysis for {package} ({cve_id}). Desc: {description}. Explain root cause, impact, and exploit method in 3-4 detailed sentences."""
    try:
        completion = client.chat.completions.create(model="llama-3.1-8b-instant", messages=[{"role": "user", "content": prompt}], max_tokens=250)
        res = completion.choices[0].message.content.strip()
        AI_ANALYSIS_CACHE[cve_id] = res
        save_cache("ai_analysis", AI_ANALYSIS_CACHE)
        return res
    except Exception as e:
        if "429" in str(e): return "AI analysis is temporarily unavailable (Rate Limit)."
        return description
