"""Star feature: "what if fraudsters adapt". Re-score rings with some signals removed.

before    = risk from all signals
adapted   = risk after the ring stops producing the lost (cheap-to-change) signals
recovered = costly-signal reweighting: when cheap signals disappear, the detector trusts signals that are
            expensive to fake (biometric reuse, money trail, identity reuse) more.
"""
from .rings import RING_WEIGHTS, ring_risk

THRESHOLD = 60
COSTLY = {"sharedBiometric", "collectorAccount", "kickbackCycle", "sameDobFather", "similarName", "sharedAddress"}
COSTLY_BOOST = 1.6

SCENARIOS = [
    {"id": "freshAccounts", "label": "Ring opens a fresh bank account and UPI ID per member", "description": "Removes shared-account and shared-UPI signals."},
    {"id": "spreadOut", "label": "Ring registers from different IPs over weeks", "description": "Removes shared-IP and burst signals."},
    {"id": "freshContacts", "label": "Ring buys unrelated SIMs and real-looking emails", "description": "Removes batch-phone, shared-phone and templated-email signals."},
    {"id": "allAdaptations", "label": "All of the above", "description": "Worst case."},
]
LOST = {
    "freshAccounts": ["sharedAccount", "sharedUpi"],
    "spreadOut": ["sharedIp", "registrationBurst"],
    "freshContacts": ["batchPhone", "sharedPhone", "templatedEmail"],
    "allAdaptations": ["sharedAccount", "sharedUpi", "sharedIp", "registrationBurst", "batchPhone", "sharedPhone", "templatedEmail"],
}
BOOSTED = {s: w * (COSTLY_BOOST if s in COSTLY else 1) for s, w in RING_WEIGHTS.items()}


def run(result: dict, scenario: str):
    """POST /api/stress-test shape, or None for an unknown scenario."""
    if scenario not in LOST:
        return None
    lost = LOST[scenario]
    rows = []
    for ring in result["rings"]:
        if ring["riskScore"] < 40:
            continue
        cov = {s["signal"]: s["value"] for s in ring["signalBreakdown"]}
        remaining = {s: c for s, c in cov.items() if s not in lost}
        before = ring_risk(cov)
        adapted = ring_risk(remaining) if remaining else 0
        recovered = ring_risk(remaining, weights=BOOSTED) if remaining else 0
        rows.append({"ringId": ring["ringId"], "before": before, "adapted": adapted, "recovered": recovered,
                     "detectedAfter": recovered >= THRESHOLD, "_remaining": [s for s in remaining if s in COSTLY]})
    count = lambda key: sum(r[key] >= THRESHOLD for r in rows)
    planted = result["baseline"]["planted"]["rings"] or 1
    used = sorted({s for r in rows if r["detectedAfter"] for s in r["_remaining"]})
    before, adapted, recovered = count("before"), count("adapted"), count("recovered")
    return {
        "scenario": scenario,
        "before": {"ringsDetected": before, "recall": round(before / planted, 2)},
        "adapted": {"ringsDetected": adapted, "recall": round(adapted / planted, 2), "lostSignals": lost},
        "recovered": {"ringsDetected": recovered, "recall": round(recovered / planted, 2), "signalsUsed": used},
        "rings": [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows],
        "takeaway": f"Adapting drops detection from {before} to {adapted} rings; trusting costly signals "
                    f"({', '.join(used) or 'none left'}) recovers {recovered}.",
    }
