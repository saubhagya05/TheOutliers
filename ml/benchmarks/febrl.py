"""Public benchmark: our record-linkage matcher on the Febrl datasets (known duplicate pairs).

Febrl ships inside the `recordlinkage` package (pip install recordlinkage), no download needed.
Same building blocks as pipeline/linkage.py: Levenshtein name similarity (rapidfuzz), phonetic match
(jellyfish metaphone), DOB comparison, address normalisation (house number + postcode) and an ID number
(Febrl's soc_sec_id plays the role of Aadhaar). Febrl has no father's name, so that part is not tested.

Honest protocol: the match threshold is chosen on Febrl1 only; Febrl2, Febrl3 and Febrl4 are reported.
Baseline: a plain unique-key check (same ID number, or same name + DOB), like the checks ghosts slip through.

Usage (from repo root): python ml/benchmarks/febrl.py   -> adds results to ml/data/benchmarks.json ("public")
"""
import json
from collections import defaultdict
from itertools import combinations
from pathlib import Path

import jellyfish
from rapidfuzz import fuzz
from recordlinkage.datasets import load_febrl1, load_febrl2, load_febrl3, load_febrl4

OUT = Path(__file__).resolve().parent.parent / "data" / "benchmarks.json"
MAX_BLOCK = 300


def s(v):
    return "" if v is None or v != v else str(v).strip().lower()


def prep(df):
    rows = {}
    for rid, r in df.iterrows():
        given, surname = s(r["given_name"]), s(r["surname"])
        rows[rid] = {
            "given": given, "surname": surname, "name": f"{given} {surname}".strip(),
            "mp_given": jellyfish.metaphone(given) if given else "", "mp_surname": jellyfish.metaphone(surname) if surname else "",
            "dob": s(r["date_of_birth"]), "postcode": s(r["postcode"]), "number": s(r["street_number"]),
            "street": s(r["address_1"]), "id": s(r["soc_sec_id"]),
        }
    return rows


def block_keys(r):
    """Multi-pass blocking: a true pair only needs to agree on one key to be compared."""
    keys = [("dob", r["dob"]), ("postcode", r["postcode"]), ("id", r["id"]),
            ("sn", r["mp_surname"] + r["dob"][:4]), ("gn", r["mp_given"] + r["postcode"][:2])]
    return [k for k in keys if k[1]]


def candidates(rows_a, rows_b=None):
    blocks = defaultdict(lambda: ([], []))
    for rid, r in rows_a.items():
        for k in block_keys(r):
            blocks[k][0].append(rid)
    if rows_b is not None:
        for rid, r in rows_b.items():
            for k in block_keys(r):
                blocks[k][1].append(rid)
    pairs = set()
    for left, right in blocks.values():
        if rows_b is None:
            if 2 <= len(left) <= MAX_BLOCK:
                pairs.update(tuple(sorted(p)) for p in combinations(left, 2))
        elif left and right and len(left) * len(right) <= MAX_BLOCK ** 2:
            pairs.update((a, b) for a in left for b in right)
    return pairs


def score(a, b):
    """0..1 match score from the same signals the pipeline uses for near-duplicate identities."""
    name = max(fuzz.ratio(a["name"], b["name"]), fuzz.token_sort_ratio(a["name"], b["name"])) / 100
    phonetic = 1.0 if (a["mp_given"] and a["mp_given"] == b["mp_given"]) or (a["mp_surname"] and a["mp_surname"] == b["mp_surname"]) else 0.0
    dob = 1.0 if a["dob"] and a["dob"] == b["dob"] else 0.5 if a["dob"] and b["dob"] and fuzz.ratio(a["dob"], b["dob"]) >= 85 else 0.0
    same_house = a["number"] and a["number"] == b["number"] and a["postcode"] == b["postcode"]
    addr = 1.0 if same_house else 0.5 if (a["postcode"] and a["postcode"] == b["postcode"]) or fuzz.ratio(a["street"], b["street"]) >= 85 else 0.0
    idn = 1.0 if a["id"] and a["id"] == b["id"] else 0.5 if a["id"] and b["id"] and fuzz.ratio(a["id"], b["id"]) >= 85 else 0.0
    return 0.35 * name + 0.10 * phonetic + 0.20 * dob + 0.15 * addr + 0.20 * idn


def unique_key_match(a, b):
    return (a["id"] and a["id"] == b["id"]) or (a["name"] and a["name"] == b["name"] and a["dob"] == b["dob"])


def prf(pred, truth):
    tp = len(pred & truth)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(truth) if truth else 0.0
    return round(p, 3), round(r, 3), round(2 * p * r / (p + r), 3) if p + r else 0.0


def load(name):
    if name == "Febrl4":
        a, b, links = load_febrl4(return_links=True)
        ra, rb = prep(a), prep(b)
        truth = {(x, y) for x, y in links}
        return ra, rb, truth, candidates(ra, rb)
    df, links = {"Febrl1": load_febrl1, "Febrl2": load_febrl2, "Febrl3": load_febrl3}[name](return_links=True)
    rows = prep(df)
    truth = {tuple(sorted(p)) for p in links}
    return rows, rows, truth, candidates(rows)


def evaluate(name, threshold):
    ra, rb, truth, cands = load(name)
    scored = {pair: score(ra[pair[0]], rb[pair[1]]) for pair in cands}
    pred = {pair for pair, v in scored.items() if v >= threshold}
    base = {pair for pair in cands if unique_key_match(ra[pair[0]], rb[pair[1]])}
    p, r, f = prf(pred, truth)
    bp, br, bf = prf(base, truth)
    return {"dataset": name, "pairs": len(truth), "candidatePairs": len(cands),
            "blockingRecall": round(len(cands & truth) / len(truth), 3),
            "precision": p, "recall": r, "f1": f,
            "baseline": {"method": "Unique key (same ID, or same name + DOB)", "precision": bp, "recall": br, "f1": bf}}, scored, truth


def tune_threshold():
    _, scored, truth = evaluate("Febrl1", 1.1)
    best = max((prf({k for k, v in scored.items() if v >= t / 100}, truth)[2], t / 100) for t in range(30, 96))
    return best[1]


def main():
    threshold = tune_threshold()
    results = [evaluate(name, threshold)[0] for name in ("Febrl1", "Febrl2", "Febrl3", "Febrl4")]
    print(f"threshold (chosen on Febrl1): {threshold}")
    for r in results:
        tag = " (tuning set)" if r["dataset"] == "Febrl1" else ""
        print(f"{r['dataset']:<7} pairs={r['pairs']:<5} P={r['precision']} R={r['recall']} F1={r['f1']}  "
              f"blocking recall={r['blockingRecall']} | unique-key baseline R={r['baseline']['recall']} F1={r['baseline']['f1']}{tag}")

    reported = [r for r in results if r["dataset"] != "Febrl1"]
    public = [{
        "dataset": r["dataset"], "component": "Name / DOB / address / ID matcher (record linkage)",
        "precision": r["precision"], "recall": r["recall"], "f1": r["f1"], "pairs": r["pairs"],
        "baselineRecall": r["baseline"]["recall"],
        "note": "Threshold set on Febrl1; this set was not used for tuning. Febrl has no father's name.",
    } for r in reported]
    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    data["public"] = public
    data["notes"] = ("Headline numbers are from the held-out test set (different seed, ring sizes, noise and rates); the "
                     "detector was tuned on the dev set only. Public benchmark: the record-linkage matcher on Febrl2-4 "
                     "(threshold chosen on Febrl1).")
    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"wrote public results to {OUT}")


if __name__ == "__main__":
    main()
