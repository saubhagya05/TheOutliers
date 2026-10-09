"""Orchestrates the full pipeline and builds the audit bundle (docs/API.md section 3, "Audit bundle").

load -> linkage hubs + money hubs -> entity graph -> components / Louvain -> ring scoring
     -> lone scoring (noisy-OR + Isolation Forest) -> explanations -> baseline -> bundle
"""
import time
from collections import Counter
from statistics import median

from . import baseline, explain, graph, linkage, load, lone, money, rings
from .util import now_iso, parse_ts

_state = {"rows": [], "details": {}, "kinds": {}}


def run_audit(audit_id: str, data_dir=None) -> dict:
    started = time.perf_counter()
    rows = load.load_ledger(data_dir)
    transfers = load.load_transfers(data_dir)
    by_id = {r["beneficiary_id"]: r for r in rows}
    account_names = {r["bank_account_number"]: explain.account_label(r) for r in rows}

    hubs = linkage.link_records(rows)
    money_hubs, money_info = money.analyse_money(rows, transfers)
    g = graph.build_graph(hubs + money_hubs)
    groups = graph.find_groups(g)
    ring_list = rings.find_rings(by_id, groups, money_info, account_names)

    counts = {"phone": Counter(r["phone"] for r in rows), "account": Counter(r["bank_account_number"] for r in rows),
              "ip": Counter(r["registration_ip"] for r in rows)}
    typical = {"loginFailed": median(int(r["login_attempts_failed"]) for r in rows),
               "loginWindowMinutes": median(int(r["login_window_minutes"]) for r in rows),
               "registrationHour": median(parse_ts(r["registration_ts"]).hour for r in rows)}
    in_rings = {m["recordId"] for r in ring_list if r["riskScore"] >= 40 for m in r["members"]}
    lone_items, normal_risk, x, candidates = lone.score_lone(rows, in_rings, counts)
    points = lone.points(x, candidates, lone_items)

    details = explain.record_details(rows, ring_list, lone_items, normal_risk, counts, typical)
    _state.update(rows=rows, details=details)
    flagged_ids = {m["recordId"] for r in ring_list for m in r["members"]} | {i["recordId"] for i in lone_items}
    duration = time.perf_counter() - started

    return {
        "auditId": audit_id,
        "oracle": False,
        "finishedAt": now_iso(),
        "datasetName": load.DATASET_NAME,
        "recordsScanned": len(rows),
        "transfersScanned": len(transfers),
        "auditDurationSeconds": round(duration, 2),
        "memberColumns": explain.member_columns(),
        "loneColumns": explain.lone_columns(),
        "rings": ring_list,
        "contextNodes": graph.context_nodes(rows, flagged_ids),
        "lone": lone_items,
        "points": points,
        "baseline": baseline.compare(rows, ring_list, lone_items, data_dir),
    }


def get_record(record_id: str):
    return _state["details"].get(record_id)


def search_records(q: str, limit: int):
    """Name (case-insensitive substring), record ID, or last digits of phone."""
    needle = q.lower()
    out = []
    for r in _state["rows"]:
        if needle in r["full_name"].lower() or needle in r["beneficiary_id"].lower() or r["phone"].endswith(needle):
            d = _state["details"][r["beneficiary_id"]]
            out.append({"recordId": r["beneficiary_id"], "name": r["full_name"], "district": r["district"],
                        "riskScore": d["riskScore"], "kind": d["kind"]})
            if len(out) >= limit:
                break
    return out
