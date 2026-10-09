"""Orchestrates the full pipeline and builds the audit bundle (docs/API.md section 3, "Audit bundle").

Order: load -> linkage -> graph -> rings -> lone -> explain -> baseline -> bundle.
Each step lives in its own module so it can be built and tested separately.
"""
from . import baseline, explain, graph, linkage, load, lone, rings

_records = None  # pandas DataFrame of the whole ledger, with scores added
_details = {}    # recordId -> record detail dict (GET /audit/{id}/records/{recordId} shape)


def run_audit(audit_id: str) -> dict:
    global _records, _details
    df = load.load_ledger()                       # step 1
    pairs = linkage.link_records(df)              # step 2
    g = graph.build_graph(df, pairs)              # step 3
    ring_list = rings.find_rings(df, g)           # step 4
    lone_list = lone.score_lone(df, ring_list)    # step 5
    _details = explain.record_details(df, ring_list, lone_list)
    _records = df

    return {
        "auditId": audit_id,
        "finishedAt": None,  # app.py fills status times; keep for shape parity
        "datasetName": load.DATASET_NAME,
        "recordsScanned": int(len(df)),
        "transfersScanned": None,       # TODO(ml): len(load.load_transfers())
        "auditDurationSeconds": None,   # TODO(ml): time the run; the UI shows records/second
        "memberColumns": explain.member_columns(),
        "loneColumns": explain.lone_columns(),
        "rings": ring_list,
        "contextNodes": graph.context_nodes(df, ring_list, limit=2000),
        "lone": lone_list,
        "points": lone.points(df, lone_list),
        "baseline": baseline.compare(df, ring_list, lone_list),
    }


def get_record(record_id: str):
    return _details.get(record_id)


def search_records(q: str, limit: int):
    """Match name (case-insensitive substring), record ID, or last digits of phone.
    Return items shaped {recordId, name, district, riskScore, kind}."""
    # TODO(ml): implement over _records
    raise NotImplementedError("search_records")
