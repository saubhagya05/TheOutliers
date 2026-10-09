"""Score the real pipeline against the ground truth. The only code (besides the mock-bundle oracle) that reads truth.csv.

Usage (from repo root):
    python ml/benchmark.py              # dev (tuning) + test (held-out) sets -> ml/data/benchmarks.json
    python ml/benchmark.py --scale ml/data/scale    # also time a large run (generate it first)

A planted ring counts as found when one reported ring (risk >= 40) holds at least half of its members and at least
half of that reported ring's members belong to it. Reported rings that match nothing are false alerts.
"""
import argparse
import csv
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))
from pipeline import audit  # noqa: E402

RING_MIN_RISK = 40


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return round(p, 2), round(r, 2), round(2 * p * r / (p + r), 2) if p + r else 0.0


def evaluate(data_dir: Path) -> dict:
    result = audit.run_audit("BENCH", data_dir)
    with open(data_dir / "truth.csv", encoding="utf-8") as f:
        truth = list(csv.DictReader(f))
    planted = defaultdict(set)
    ring_type = {}
    held_out = {}
    for t in truth:
        if t["ring_id"]:
            planted[t["ring_id"]].add(t["beneficiary_id"])
            ring_type[t["ring_id"]] = t["ring_type"]
            held_out[t["ring_id"]] = t["held_out"] == "True"
    lone_truth = {t["beneficiary_id"] for t in truth if t["label"] == "lone"}

    reported = [r for r in result["rings"] if r["riskScore"] >= RING_MIN_RISK]
    found, matched_reports = set(), set()
    for r in reported:
        members = {m["recordId"] for m in r["members"]}
        for pid, pmembers in planted.items():
            overlap = len(members & pmembers)
            if overlap >= len(pmembers) / 2 and overlap >= len(members) / 2:
                found.add(pid)
                matched_reports.add(r["ringId"])
    false_alerts = len(reported) - len(matched_reports)
    p, rc, f1 = prf(len(matched_reports), false_alerts, len(planted) - len(found))

    by_type = defaultdict(lambda: {"planted": 0, "found": 0, "heldOut": False})
    for pid in planted:
        t = by_type[ring_type[pid]]
        t["planted"] += 1
        t["found"] += pid in found
        t["heldOut"] = held_out[pid]

    flagged_members = {m["recordId"] for r in reported for m in r["members"]}
    all_members = set().union(*planted.values()) if planted else set()
    mp, mr, mf = prf(len(flagged_members & all_members), len(flagged_members - all_members), len(all_members - flagged_members))

    flagged_lone = {i["recordId"] for i in result["lone"]}
    lp, lr, lf = prf(len(flagged_lone & lone_truth), len(flagged_lone - lone_truth), len(lone_truth - flagged_lone))

    secs = result["auditDurationSeconds"] or 1e-9
    return {
        "rings": {"planted": len(planted), "found": len(found), "falseAlerts": false_alerts, "precision": p, "recall": rc, "f1": f1},
        "ringMembers": {"precision": mp, "recall": mr, "f1": mf},
        "lone": {"planted": len(lone_truth), "found": len(flagged_lone & lone_truth), "falseAlerts": len(flagged_lone - lone_truth),
                 "precision": lp, "recall": lr, "f1": lf},
        "byRingType": [{"type": k, **v} for k, v in sorted(by_type.items())],
        "throughput": {"records": result["recordsScanned"], "transfers": result["transfersScanned"], "seconds": secs,
                       "recordsPerSecond": round(result["recordsScanned"] / secs)},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", help="folder with a large generated dataset to time (truth optional)")
    ap.add_argument("--dev-only", action="store_true", help="tuning loop: score the dev set only, write nothing")
    args = ap.parse_args()

    dev = evaluate(ML / "data")
    if args.dev_only:
        s = dev
        print(f"[dev] rings P={s['rings']['precision']} R={s['rings']['recall']} (found {s['rings']['found']}/{s['rings']['planted']}, "
              f"false alerts {s['rings']['falseAlerts']}) | members F1={s['ringMembers']['f1']} | "
              f"lone P={s['lone']['precision']} R={s['lone']['recall']} F1={s['lone']['f1']}")
        return
    test = evaluate(ML / "data" / "test")
    out = {
        # The headline numbers are the held-out test set: the detector was tuned on dev only.
        "simulatedLedger": {"rings": test["rings"], "lone": test["lone"]},
        "testSet": test,
        "devSet": dev,
        "public": [],
        "notes": "Headline numbers are from the held-out test set (different seed, ring sizes, noise and rates); "
                 "the detector was tuned on the dev set only. Public benchmarks (Febrl / NCVR) not run yet.",
        "ranAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if args.scale:
        scale = evaluate(Path(args.scale)) if (Path(args.scale) / "truth.csv").exists() else None
        if scale:
            out["scaleRun"] = scale["throughput"]
    (ML / "data" / "benchmarks.json").write_text(json.dumps(out, indent=2), encoding="utf-8")

    for name, s in (("dev", dev), ("test", test)):
        print(f"[{name}] rings P={s['rings']['precision']} R={s['rings']['recall']} F1={s['rings']['f1']} "
              f"(found {s['rings']['found']}/{s['rings']['planted']}, false alerts {s['rings']['falseAlerts']}) | "
              f"members F1={s['ringMembers']['f1']} | lone P={s['lone']['precision']} R={s['lone']['recall']} F1={s['lone']['f1']} | "
              f"{s['throughput']['recordsPerSecond']} records/s")
        for t in s["byRingType"]:
            print(f"    {t['type']:<16} {t['found']}/{t['planted']}{'  (held out)' if t['heldOut'] else ''}")
    if "scaleRun" in out:
        print("[scale]", out["scaleRun"])


if __name__ == "__main__":
    main()
