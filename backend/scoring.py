# backend/scoring.py
# Snyk/Dependabot-aligned risk scoring — replaces the ad-hoc logic in _analyze_single

from dataclasses import dataclass, field
from typing import Optional, Dict
import math

SEV_THRESHOLDS = {
    "CRITICAL": 9.0,
    "HIGH":     7.0,
    "MEDIUM":   4.0,
    "LOW":      1.0,
    "SAFE":     0.0,
}

@dataclass
class ScoringInput:
    # Vulnerability data
    cvss_base: float          # 0–10, from OSV/NVD CVSS v3
    cvss_vector: str          # e.g. "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
    exploit_maturity: str     # "PROOF_OF_CONCEPT" | "FUNCTIONAL" | "HIGH" | "NOT_DEFINED"
    is_reachable: bool        # true if import/require found in user codebase
    is_direct: bool           # true if in dependencies (not node_modules transitive)
    depth: int                # 0=direct, 1+=transitive
    
    # Package health (from npm registry)
    days_since_modified: int  # from npm time.modified
    days_since_created: int   # from npm time.created
    maintainer_count: int
    weekly_downloads: int
    versions_behind: int      # how many semver versions behind latest
    is_major_behind: bool     # true if major version jump
    has_deprecation_notice: bool
    
    # Fix availability
    fix_available: bool
    fix_breaks_api: bool      # major bump = likely breaking
    
    # Threat Intelligence (RAG)
    threat_intel_score: float = 0.0 # 0–10 boost from Groq/Pinecone

def compute_risk_score(inp: ScoringInput) -> tuple[float, str, dict]:
    """
    Returns (score_0_to_10, severity_label, breakdown_dict)
    
    Algorithm mirrors Snyk's priority score:
    https://docs.snyk.io/manage-risk/prioritize-issues-for-fixing/priority-score
    
    And Dependabot severity mapping:
    https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts
    """
    breakdown = {}

    # ── 1. CVSS base (weight: 40%) ──────────────────────────────────────────
    # Use CVSS v3 base score directly. If vector available, parse Attack Vector
    # to apply network-exploitability boost.
    cvss_component = inp.cvss_base
    if "AV:N" in inp.cvss_vector:   # Network-accessible — highest risk
        cvss_component = min(10, cvss_component * 1.05)
    elif "AV:A" in inp.cvss_vector: # Adjacent network
        cvss_component = cvss_component * 0.95
    elif "AV:L" in inp.cvss_vector: # Local
        cvss_component = cvss_component * 0.85
    elif "AV:P" in inp.cvss_vector: # Physical
        cvss_component = cvss_component * 0.70
    breakdown["cvss"] = round(cvss_component, 2)

    # ── 2. Exploit maturity (weight: 20%) ───────────────────────────────────
    # Snyk calls this "Exploit Maturity" — a known working exploit is far worse
    exploit_multiplier = {
        "HIGH":              1.20,
        "FUNCTIONAL":        1.15,
        "PROOF_OF_CONCEPT":  1.05,
        "NOT_DEFINED":       1.00,
        "UNPROVEN":          0.95,
    }.get(inp.exploit_maturity, 1.00)
    breakdown["exploit_multiplier"] = exploit_multiplier

    # ── 3. Reachability (weight: 15%) ───────────────────────────────────────
    # Snyk's biggest differentiator: if the vulnerable function is actually
    # called in your code, score stays; if unreachable, score drops 30%.
    reachability_multiplier = 1.0 if inp.is_reachable else 0.70
    breakdown["reachability_multiplier"] = reachability_multiplier

    # ── 4. Dependency depth (weight: 10%) ───────────────────────────────────
    # Dependabot distinguishes direct vs transitive.
    # Transitive = harder to fix, but also often less directly exploitable.
    if inp.is_direct:
        depth_multiplier = 1.0
    elif inp.depth == 1:
        depth_multiplier = 0.90
    elif inp.depth == 2:
        depth_multiplier = 0.82
    else:
        depth_multiplier = 0.75  # deep transitive
    breakdown["depth_multiplier"] = depth_multiplier

    # ── 5. Package health penalty (weight: 10%) ─────────────────────────────
    # Abandoned/unmaintained packages: vulnerability won't get fixed upstream
    health_penalty = 0.0
    if inp.has_deprecation_notice:
        health_penalty += 0.8       # deprecated = almost certainly no fix coming
    elif inp.days_since_modified > 730:   # >2 years
        health_penalty += 0.6
    elif inp.days_since_modified > 365:   # >1 year
        health_penalty += 0.3
    
    if inp.maintainer_count == 0:
        health_penalty += 0.5
    elif inp.maintainer_count == 1:
        health_penalty += 0.2       # bus factor risk
    
    if inp.weekly_downloads < 1000:
        health_penalty += 0.2       # low adoption = lower scrutiny
    
    breakdown["health_penalty"] = round(min(health_penalty, 2.0), 2)

    # ── 6. Fix penalty (weight: 5%) ─────────────────────────────────────────
    fix_penalty = 0.0
    if not inp.fix_available:
        fix_penalty = 0.5           # no fix = stuck with the vulnerability
    elif inp.fix_breaks_api:
        fix_penalty = 0.2           # fix exists but it's a breaking change
    breakdown["fix_penalty"] = fix_penalty

    # ── Combine ──────────────────────────────────────────────────────────────
    raw = (
        cvss_component
        * exploit_multiplier
        * reachability_multiplier
        * depth_multiplier
        + health_penalty
        + fix_penalty
        + (inp.threat_intel_score * 0.2) # 20% weight for active threat intel
    )
    score = round(min(max(raw, 0.0), 10.0), 1)

    # Severity label — mirrors Dependabot's own thresholds
    if score >= SEV_THRESHOLDS["CRITICAL"]:
        sev = "CRITICAL"
    elif score >= SEV_THRESHOLDS["HIGH"]:
        sev = "HIGH"
    elif score >= SEV_THRESHOLDS["MEDIUM"]:
        sev = "MEDIUM"
    elif score >= SEV_THRESHOLDS["LOW"]:
        sev = "LOW"
    else:
        sev = "SAFE"

    return score, sev, breakdown
