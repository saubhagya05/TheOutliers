"""Step 4: ring scoring. Turns discovered groups into explained rings with an explainable risk index.

Risk = BASE + sum(signal weight x share of members carrying it), discounted when the group looks like one family.
Expensive-to-fake signals (biometric, money trail) weigh more than cheap ones (shared IP, address).
"""
from collections import Counter

from . import explain
from .util import risk_level

RING_WEIGHTS = {"sharedBiometric": 20, "collectorAccount": 18, "kickbackCycle": 16, "sharedAccount": 16,
                "sharedUpi": 14, "registrationBurst": 12, "batchPhone": 10, "templatedEmail": 10, "sameDobFather": 10,
                "sharedIp": 8, "similarName": 8, "sharedAddress": 8, "sharedPhone": 8}
BASE = 42
REPORT_MIN_RISK = 25      # groups below this are not surfaced at all
FAMILY_FACTOR = 0.6


def ring_risk(coverage, family_factor=1.0, weights=RING_WEIGHTS):
    return min(98, round((BASE + sum(weights.get(s, 6) * c for s, c in coverage.items())) * family_factor))


def family_share(rows):
    """Share of members whose (surname, father) pair also appears on another member."""
    pairs = Counter((r["full_name"].split()[-1].lower(), r["father_name"].lower()) for r in rows)
    return sum(pairs[(r["full_name"].split()[-1].lower(), r["father_name"].lower())] > 1 for r in rows) / len(rows)


def find_rings(rows_by_id, groups, money, account_names) -> list:
    """Return rings in the GET /api/rings/:ringId shape (docs/API.md 2.2), without Express-owned fields."""
    candidates = []
    for ids in groups:
        rows = [rows_by_id[i] for i in ids]
        a = explain.analyse_ring("tmp", rows, money, account_names)
        if not a["coverage"]:
            continue
        family = family_share(rows) >= 0.6
        risk = ring_risk(a["coverage"], FAMILY_FACTOR if family else 1.0)
        if risk >= REPORT_MIN_RISK:
            candidates.append((risk, ids, family))

    rings = []
    for idx, (risk, ids, family) in enumerate(sorted(candidates, key=lambda c: -c[0]), start=1):
        ring_id = f"R-{idx:03d}"
        rows = [rows_by_id[i] for i in ids]
        a = explain.analyse_ring(ring_id, rows, money, account_names)  # re-run with the final id for stable hub ids
        cov = a["coverage"]
        total = sum(RING_WEIGHTS.get(s, 6) * c for s, c in cov.items())
        ordered = sorted(cov, key=lambda s: -RING_WEIGHTS.get(s, 6) * cov[s])
        reasons = [{"signal": s, "label": explain.ring_reason_label(s, a["carriers"], rows_by_id),
                    "weight": round(RING_WEIGHTS.get(s, 6) * cov[s] / total, 2)} for s in ordered]
        members = []
        for r in rows:
            own = {x["signal"] for x in a["anomalies"][r["beneficiary_id"]]}
            m_risk = max(15, min(99, risk - 10 + 4 * len(own)))
            members.append({"recordId": r["beneficiary_id"], "fields": explain.to_fields(r, m_risk),
                            "anomalies": a["anomalies"][r["beneficiary_id"]], "riskScore": m_risk, "riskLevel": risk_level(m_risk)})
        amount = sum(int(r["amount_inr"]) for r in rows)
        district = Counter(r["district"] for r in rows).most_common(1)[0][0]
        nodes = [{"id": m["recordId"], "type": "beneficiary", "label": m["fields"]["name"], "ringId": ring_id, "riskScore": m["riskScore"]} for m in members]
        nodes += [{"id": h["id"], "type": h["type"], "label": h["label"], "ringId": ring_id, "riskScore": risk} for h in a["hubs"]]
        top = "; ".join(x["label"][0].lower() + x["label"][1:] for x in reasons[:3])
        summary = (f"{len(rows)} beneficiaries in {district} share family ties (same surname and father). The pattern may be legitimate, "
                   f"so the score is discounted; verify before acting." if family else
                   f"{len(rows)} beneficiaries in {district} with different names and Aadhaar numbers are linked: {top}. "
                   f"₹{amount / 100000:.1f} lakh is at risk.")
        rings.append({
            "ringId": ring_id, "riskScore": risk, "riskLevel": risk_level(risk), "district": district, "ringType": ordered[0],
            "memberCount": len(rows), "amountAtRiskInr": amount, "summary": summary, "reasons": reasons, "topReasons": reasons[:3],
            "signalBreakdown": [{"signal": s, "label": explain.SIGNAL_LABELS[s], "value": round(cov[s], 2)} for s in ordered],
            "sharedEntities": sorted(a["hubs"], key=lambda h: -h["linkedMembers"]),
            "graph": {"nodes": nodes, "edges": a["edges"]}, "timeline": a["timeline"],
            "columns": explain.member_columns(), "members": members,
        })
    add_priority(rings)
    return rings


def add_priority(rings):
    """Investigation priority: recoverable money per unit of effort."""
    if not rings:
        return
    max_amount = max(r["amountAtRiskInr"] for r in rings)
    for r in rings:
        effort = "low" if r["memberCount"] <= 8 else "high" if r["memberCount"] >= 14 else "medium"
        money_trail = any(s["signal"] in ("sharedAccount", "sharedUpi", "collectorAccount") for s in r["signalBreakdown"])
        share = 0.1 if r["riskScore"] < 40 else (0.85 if money_trail else 0.6)
        recoverable = round(r["amountAtRiskInr"] * share / 1000) * 1000
        r["priority"] = {"priorityScore": min(100, round(recoverable / max_amount * 70 + {"low": 30, "medium": 18, "high": 6}[effort])),
                         "rank": 0, "recoverableInr": recoverable, "effort": effort}
    for rank, r in enumerate(sorted(rings, key=lambda r: -r["priority"]["priorityScore"]), start=1):
        r["priority"]["rank"] = rank
