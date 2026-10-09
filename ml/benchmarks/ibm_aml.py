"""Public benchmark: our money-flow detectors on IBM Transactions for Anti Money Laundering (HI-Small).

Data (Kaggle, not committed): ml/data/public/ibm_aml/HI-Small_Trans.csv and HI-Small_Patterns.txt.
The patterns file lists every laundering attempt with its type; we score the two types our pipeline targets:

- FAN-IN  -> our collector detector (pipeline/money.py): an account that receives from MIN_SENDERS or more distinct
             senders within FORWARD_WINDOW, ignoring public hubs (accounts with more than MAX_SENDERS partners).
             IBM data has no scholarship payout, so "within 24 h of payout" becomes "within a 24 h window".
- CYCLE   -> our bounded cycle detection (nx.simple_cycles with a length bound) on the hub-free transfer graph.

Same constants as the pipeline; nothing was tuned on this data. Usage: python ml/benchmarks/ibm_aml.py
"""
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import networkx as nx
import pandas as pd

ML = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML))
from pipeline.money import FORWARD_WINDOW_S, MAX_SENDERS, MIN_SENDERS  # noqa: E402

DATA = ML / "data" / "public" / "ibm_aml"
OUT = ML / "data" / "benchmarks.json"
CYCLE_BOUND = 10          # IBM cycles are at most 10 hops
GIANT_SCC = 1000          # components larger than this get a time budget per start node
GIANT_BUDGET_S = 240


def load():
    df = pd.read_csv(DATA / "HI-Small_Trans.csv", dtype=str, usecols=[0, 1, 2, 3, 4, 10])
    df.columns = ["ts", "fb", "fa", "tb", "ta", "laund"]
    df["src"] = df.fb + "|" + df.fa
    df["dst"] = df.tb + "|" + df.ta
    df = df[df.src != df.dst].copy()          # self transfers (reinvestment) are not flows between accounts
    df["t"] = pd.to_datetime(df.ts, format="%Y/%m/%d %H:%M").astype("int64") // 10 ** 9
    return df


def load_patterns():
    pats, cur = [], None
    for line in open(DATA / "HI-Small_Patterns.txt", encoding="utf-8"):
        line = line.strip()
        if line.startswith("BEGIN"):
            head = line.split(" - ", 1)[1]
            cur = {"type": head.split(":")[0].strip(), "tx": []}
        elif line.startswith("END"):
            pats.append(cur)
            cur = None
        elif cur is not None and line:
            f = line.split(",")
            cur["tx"].append((f[1] + "|" + f[2], f[3] + "|" + f[4]))
    return pats


def public_hubs(df):
    indeg = df.groupby("dst").src.nunique()
    outdeg = df.groupby("src").dst.nunique()
    return set(indeg[indeg > MAX_SENDERS].index) | set(outdeg[outdeg > MAX_SENDERS].index)


def detect_fan_in(df, hubs):
    """Accounts receiving from >= MIN_SENDERS distinct senders inside one FORWARD_WINDOW (sliding)."""
    d = df[~df.dst.isin(hubs) & ~df.src.isin(hubs)][["dst", "src", "t"]]
    counts = d.groupby("dst").src.nunique()
    d = d[d.dst.isin(counts[counts >= MIN_SENDERS].index)].sort_values(["dst", "t"])
    flagged = set()
    for dst, grp in d.groupby("dst", sort=False):
        times, senders = grp.t.to_numpy(), grp.src.to_numpy()
        start = 0
        for end in range(len(times)):
            while times[end] - times[start] > FORWARD_WINDOW_S:
                start += 1
            if len(set(senders[start:end + 1])) >= MIN_SENDERS:
                flagged.add(dst)
                break
    return flagged


def detect_cycles(df, hubs):
    e = df[~df.src.isin(hubs) & ~df.dst.isin(hubs)][["src", "dst"]].drop_duplicates()
    g = nx.DiGraph()
    g.add_edges_from(e.itertuples(index=False, name=None))
    cycles, giant_info = [], {}
    for comp in nx.strongly_connected_components(g):
        if len(comp) < 2:
            continue
        sub = g.subgraph(comp)
        if len(comp) <= GIANT_SCC:
            cycles.extend(nx.simple_cycles(sub, length_bound=CYCLE_BOUND))
            continue
        # Giant component: exhaustive search explodes, so enumerate within a time budget and report coverage.
        started, found, complete = time.time(), 0, True
        for c in nx.simple_cycles(sub, length_bound=CYCLE_BOUND):
            cycles.append(c)
            found += 1
            if time.time() - started > GIANT_BUDGET_S:
                complete = False
                break
        giant_info = {"nodes": len(comp), "cyclesEnumerated": found, "complete": complete,
                      "seconds": round(time.time() - started, 1)}
    return cycles, giant_info


def prf(tp, fp, fn):
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    return round(p, 3), round(r, 3), round(2 * p * r / (p + r), 3) if p + r else 0.0


def main():
    t0 = time.time()
    df = load()
    pats = load_patterns()
    hubs = public_hubs(df)
    laundering_accounts = set(df.loc[df.laund == "1", "src"]) | set(df.loc[df.laund == "1", "dst"])
    all_accounts = set(df.src) | set(df.dst)
    base_rate = len(laundering_accounts) / len(all_accounts)   # precision of flagging accounts at random
    print(f"{len(df):,} transfers, {df.src.nunique():,} senders, {len(hubs)} public hubs, "
          f"{len(laundering_accounts):,} laundering accounts ({round(time.time() - t0)} s)")

    # FAN-IN
    t1 = time.time()
    fan_flags = detect_fan_in(df, hubs)
    fan_pats = [p for p in pats if p["type"] == "FAN-IN"]
    sinks = []
    for p in fan_pats:
        dsts = defaultdict(int)
        for _, d in p["tx"]:
            dsts[d] += 1
        sinks.append(max(dsts, key=dsts.get))
    fan_found = sum(s in fan_flags for s in sinks)
    fan_tp = len(fan_flags & laundering_accounts)
    fp, _, _ = prf(fan_tp, len(fan_flags) - fan_tp, 0)
    fan = {"patterns": len(fan_pats), "found": fan_found, "recall": round(fan_found / len(fan_pats), 3),
           "accountsFlagged": len(fan_flags), "accountPrecision": fp,
           "liftOverRandom": round(fp / base_rate, 1),
           "sinksBehindPublicHub": sum(s in hubs for s in sinks), "seconds": round(time.time() - t1, 1)}
    print("FAN-IN:", fan)

    # CYCLE
    t2 = time.time()
    cycles, giant = detect_cycles(df, hubs)
    cyc_pats = [p for p in pats if p["type"] == "CYCLE"]
    by_node = defaultdict(list)
    for i, c in enumerate(cycles):
        for n in c:
            by_node[n].append(i)
    found = 0
    for p in cyc_pats:
        nodes = {a for tx in p["tx"] for a in tx}
        cand = {i for n in nodes for i in by_node.get(n, [])}
        if any(len(nodes & set(cycles[i])) >= len(nodes) / 2 and len(nodes & set(cycles[i])) >= len(cycles[i]) / 2 for i in cand):
            found += 1
    laundering_cycles = sum(sum(n in laundering_accounts for n in c) > len(c) / 2 for c in cycles)
    cyc = {"patterns": len(cyc_pats), "found": found, "recall": round(found / len(cyc_pats), 3),
           "cyclesFound": len(cycles), "cyclePrecision": round(laundering_cycles / len(cycles), 3) if cycles else 0.0,
           "liftOverRandom": round(laundering_cycles / len(cycles) / base_rate, 1) if cycles else 0.0,
           "patternsTouchingPublicHub": sum(bool({a for tx in p["tx"] for a in tx} & hubs) for p in cyc_pats),
           "giantComponent": giant, "seconds": round(time.time() - t2, 1)}
    print("CYCLE:", cyc)

    result = {
        "dataset": "IBM AML (HI-Small)", "transfers": int(len(df)), "accounts": len(all_accounts), "publicHubs": len(hubs),
        "launderingAccountRate": round(base_rate, 4),
        "fanIn": fan, "cycle": cyc, "seconds": round(time.time() - t0, 1),
        "settings": {"MIN_SENDERS": MIN_SENDERS, "MAX_SENDERS": MAX_SENDERS, "windowHours": FORWARD_WINDOW_S // 3600,
                     "cycleBound": CYCLE_BOUND},
    }
    (DATA / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")

    data = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    public = [p for p in data.get("public", []) if not p["dataset"].startswith("IBM AML")]
    public += [
        {"dataset": "IBM AML (HI-Small)", "component": "Collector / fan-in detection", "precision": fan["accountPrecision"],
         "recall": fan["recall"], "f1": None, "liftOverRandom": fan["liftOverRandom"],
         "patterns": fan["patterns"], "found": fan["found"],
         "note": "Recall = labelled FAN-IN patterns whose collector was flagged; precision = flagged accounts involved in laundering. Same constants as the pipeline, not tuned."},
        {"dataset": "IBM AML (HI-Small)", "component": "Cycle detection (kickbacks)", "precision": cyc["cyclePrecision"],
         "recall": cyc["recall"], "f1": None, "liftOverRandom": cyc["liftOverRandom"],
         "patterns": cyc["patterns"], "found": cyc["found"],
         "note": "Recall = labelled CYCLE patterns matched by a detected cycle; precision = detected cycles made mostly of laundering accounts."},
    ]
    data["public"] = public
    OUT.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"done in {round(time.time() - t0)} s; results in {DATA / 'result.json'} and benchmarks.json")


if __name__ == "__main__":
    main()
