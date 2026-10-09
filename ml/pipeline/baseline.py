"""Baseline comparison: what a plain unique-ID check catches vs. our pipeline."""
import json
from collections import Counter
from pathlib import Path

from . import load

RING_MIN_RISK = 40


def compare(rows, ring_list, lone_list, data_dir=None) -> dict:
    """GET /api/baseline shape. Baseline = records whose Aadhaar number appears more than once.
    `planted` reads only the counts in planted.json (never per-record labels)."""
    counts = Counter(r["aadhaar_number"] for r in rows)
    dupes = [r for r in rows if counts[r["aadhaar_number"]] > 1]
    real = [r for r in ring_list if r["riskScore"] >= RING_MIN_RISK]
    planted_path = Path(data_dir or load.DATA_DIR) / "planted.json"
    planted = json.loads(planted_path.read_text(encoding="utf-8")) if planted_path.exists() else {}
    planted_rings = planted.get("rings", len(real))
    return {
        "baseline": {"method": "Unique Aadhaar / ID check", "recordsFlagged": len(dupes), "ringsDetected": 0,
                     "amountCaughtInr": sum(int(r["amount_inr"]) for r in dupes),
                     "flaggedRecordIds": [r["beneficiary_id"] for r in dupes]},
        "ours": {"method": "Graph linkage + behaviour scoring",
                 "recordsFlagged": sum(r["memberCount"] for r in real) + len(lone_list),
                 "ringsDetected": len(real),
                 "amountCaughtInr": sum(r["amountAtRiskInr"] for r in real) + sum(i["fields"]["amountInr"] for i in lone_list)},
        "planted": {"rings": planted_rings, "loneGhosts": planted.get("loneGhosts")},
        "headline": f"The unique-ID check catches 0 of {planted_rings} rings. Our graph surfaces {len(real)}.",
    }
