import os, requests

def get_hf_token():
    return os.environ.get("HF_TOKEN", "")
ZSC_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"

ATTACK_LABELS = [
    "supply chain attack",
    "remote code execution",
    "server-side request forgery",
    "prototype pollution",
    "cross-site scripting",
    "SQL injection",
    "path traversal",
    "denial of service",
    "information disclosure",
    "authentication bypass",
]

URGENCY_LABELS = [
    "patch immediately — active exploit in the wild",
    "patch soon — proof of concept exists",
    "patch at next release cycle",
    "monitor only — low exploitability",
]

CVE_CLASS_CACHE = {}   # { cve_id: classification_result }

def classify_vulnerability(cve_id: str, description: str) -> dict:
    """
    Given a CVE ID and its description, return:
      - attack_type: the most likely attack category
      - attack_score: confidence 0–1
      - urgency: recommended response timeline
      - urgency_score: confidence 0–1

    Uses facebook/bart-large-mnli zero-shot — no training needed.
    Results cached by CVE ID to avoid redundant API calls.
    """
    if cve_id in CVE_CLASS_CACHE:
        return CVE_CLASS_CACHE[cve_id]

    if not description or len(description) < 20:
        return {"attack_type": "unknown", "urgency": "monitor only — low exploitability"}

    token = get_hf_token()
    headers = {"Authorization": f"Bearer {token}"}

    def _call(labels, multi_label=False):
        for _ in range(2):
            try:
                r = requests.post(ZSC_URL, headers=headers, json={
                    "inputs": description[:1024],
                    "parameters": {
                        "candidate_labels": labels,
                        "multi_label": multi_label,
                    }
                }, timeout=5)
                if r.status_code == 503:
                    import time; time.sleep(2); continue
                r.raise_for_status()
                return r.json()
            except Exception:
                continue
        raise RuntimeError("ZSC model unavailable")

    try:
        attack_result  = _call(ATTACK_LABELS,  multi_label=True)
        urgency_result = _call(URGENCY_LABELS, multi_label=False)

        result = {
            "attack_type":   attack_result["labels"][0],
            "attack_score":  round(attack_result["scores"][0], 3),
            "all_attacks":   dict(zip(attack_result["labels"][:3],
                                      [round(s,3) for s in attack_result["scores"][:3]])),
            "urgency":       urgency_result["labels"][0],
            "urgency_score": round(urgency_result["scores"][0], 3),
        }
    except Exception:
        result = {"attack_type": "unknown", "urgency": "low urgency"}

    CVE_CLASS_CACHE[cve_id] = result
    return result

def classify_supply_chain_suspicion(
    pkg_name: str,
    new_deps: list,
    has_postinstall: bool,
    maintainer_changed: bool,
    days_since_publish: int,
) -> dict:
    """
    Special-purpose classifier for the axios-style scenario:
    given package metadata signals, classify whether this looks
    like a supply chain compromise.
    """
    # Build a natural-language description of the signals
    signals = []
    if has_postinstall:
        signals.append("it has a postinstall script that runs on npm install")
    if maintainer_changed:
        signals.append("the maintainer account changed recently")
    if days_since_publish <= 3:
        signals.append("a new version was published in the last 3 days")
    if new_deps:
        signals.append(f"new dependencies were added: {', '.join(new_deps[:5])}")

    if not signals:
        return {"supply_chain_risk": "none", "confidence": 1.0}

    text = (
        f"The npm package '{pkg_name}' shows these characteristics: "
        + "; ".join(signals) + "."
    )

    labels = [
        "compromised package with malicious code injected",
        "legitimate package update with new features",
        "suspicious package requiring manual review",
    ]
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    try:
        r = requests.post(ZSC_URL, headers=headers, json={
            "inputs": text,
            "parameters": {"candidate_labels": labels, "multi_label": False}
        }, timeout=45)
        data = r.json()

        top_label = data["labels"][0]
        top_score = round(data["scores"][0], 3)

        risk = "none"
        if "compromised" in top_label and top_score > 0.55:
            risk = "critical"
        elif "suspicious" in top_label or ("compromised" in top_label and top_score > 0.35):
            risk = "high"

        return {"supply_chain_risk": risk, "confidence": top_score, "label": top_label}
    except Exception:
        return {"supply_chain_risk": "unknown", "confidence": 0.0, "label": "error"}
