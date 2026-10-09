"""ML service. Contract: docs/API.md section 3. Only Express calls this.

Run:  uvicorn app:app --reload --port 8000
"""
import csv
import io
import itertools
import json
import threading
from datetime import datetime, timezone

from fastapi import Body, FastAPI, HTTPException

from pipeline import audit, brief, load, stress, static

app = FastAPI(title="TheOutliers ML")

STATE = {"auditId": None, "status": "idle", "startedAt": None, "finishedAt": None, "result": None, "error": None,
         "dataDir": None, "dataset": None}
_lock = threading.Lock()
_counter = itertools.count(1)


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def builtin_dataset():
    info = json.loads((load.DATA_DIR / "dataset_info.json").read_text(encoding="utf-8"))
    p = info["planted"]
    return {
        "id": "builtin", "source": "builtin", "name": info["name"],
        "recordCount": info["recordCount"], "transferCount": info.get("transferCount"),
        "description": (f"{info['recordCount']:,} simulated scholarship beneficiaries and {info.get('transferCount', 0):,} "
                        f"money transfers, with {p['rings']} planted fraud rings and {p['loneGhosts']} lone ghosts "
                        f"whose answers we know."),
    }


def _run(audit_id: str, data_dir):
    try:
        result = audit.run_audit(audit_id, data_dir)
        with _lock:
            if STATE["auditId"] == audit_id:   # ignore a run that a newer upload replaced
                if STATE["dataset"]:
                    result["datasetName"] = STATE["dataset"]["name"]
                STATE.update(status="done", finishedAt=_now(), result=result)
    except Exception as exc:  # surfaced via GET /health and GET /audit/{id}
        with _lock:
            if STATE["auditId"] == audit_id:
                STATE.update(status="failed", error=str(exc))
        raise


def _start(data_dir, dataset, force=False):
    """Audit data_dir in the background. No-op if an audit is running, or done and not forced."""
    with _lock:
        if not force and STATE["status"] in ("running", "done"):
            return {"auditId": STATE["auditId"], "status": STATE["status"]}
        audit_id = f"AUD-{datetime.now(timezone.utc):%H%M%S}-{next(_counter)}"
        STATE.update(auditId=audit_id, status="running", startedAt=_now(), finishedAt=None, result=None, error=None,
                     dataDir=data_dir, dataset=dataset)
    threading.Thread(target=_run, args=(audit_id, data_dir), daemon=True).start()
    return {"auditId": audit_id, "status": "running"}


def _result(audit_id: str):
    if STATE["auditId"] != audit_id or STATE["status"] != "done":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": f"Audit {audit_id} not ready"})
    return STATE["result"]


def _bad(message):
    raise HTTPException(400, detail={"code": "BAD_REQUEST", "message": message})


@app.get("/health")
def health():
    return {"status": "ok", "auditReady": STATE["status"] == "done", "auditId": STATE["auditId"],
            "auditStatus": STATE["status"], "error": STATE["error"], "dataset": STATE["dataset"]}


@app.post("/audit/run")
def run_audit(body: dict = Body(default={})):
    return _start(STATE["dataDir"], STATE["dataset"] or builtin_dataset(), force=bool(body.get("force")))


# ---------------------------------------------------------------- datasets

@app.get("/datasets/active")
def active_dataset():
    return {"dataset": STATE["dataset"], "auditId": STATE["auditId"], "status": STATE["status"], "error": STATE["error"]}


@app.post("/datasets/builtin")
def use_builtin():
    """Switch to our dataset. Re-runs the audit only if another dataset is active."""
    on_builtin = (STATE["dataset"] or {}).get("source") == "builtin" and STATE["status"] in ("running", "done")
    return {"dataset": builtin_dataset(), **_start(None, builtin_dataset(), force=not on_builtin)}


def _header(text):
    first = text.split("\n", 1)[0]
    return [c.strip() for c in next(csv.reader(io.StringIO(first)))]


def _rows(text):
    return sum(1 for line in text.splitlines()[1:] if line.strip())


@app.post("/datasets/upload")
def upload_dataset(body: dict = Body(...)):
    """Body: {name, ledgerCsv, transfersCsv?}. Validates the columns, stores the files and audits them."""
    ledger = (body.get("ledgerCsv") or "").lstrip("﻿")
    if not ledger.strip():
        _bad("The ledger file is empty.")
    missing = [c for c in load.LEDGER_COLUMNS if c not in _header(ledger)]
    if missing:
        _bad(f"The ledger is missing {len(missing)} required column(s): {', '.join(missing)}")
    rows = _rows(ledger)
    if rows < 10:
        _bad("The ledger needs at least 10 records.")
    transfers = (body.get("transfersCsv") or "").lstrip("﻿")
    if transfers.strip():
        missing = [c for c in load.TRANSFER_COLUMNS if c not in _header(transfers)]
        if missing:
            _bad(f"The transfers file is missing column(s): {', '.join(missing)}")
    else:
        transfers = ",".join(load.TRANSFER_COLUMNS) + "\n"   # no money data: money signals simply stay silent

    dataset_id = f"UP-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}-{next(_counter)}"
    folder = load.UPLOAD_DIR / dataset_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "ledger.csv").write_text(ledger, encoding="utf-8", newline="")
    (folder / "transfers.csv").write_text(transfers, encoding="utf-8", newline="")
    n_transfers = _rows(transfers)
    dataset = {"id": dataset_id, "source": "upload", "name": (body.get("name") or "Uploaded dataset").strip()[:80],
               "recordCount": rows, "transferCount": n_transfers,
               "description": f"Your upload: {rows:,} records and {n_transfers:,} transfers."}
    return {"dataset": dataset, **_start(folder, dataset, force=True)}


# ---------------------------------------------------------------- audit results

@app.get("/audit/{audit_id}")
def audit_status(audit_id: str):
    if STATE["auditId"] != audit_id:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": f"Audit {audit_id} does not exist"})
    result = STATE["result"] or {}
    return {
        "auditId": audit_id,
        "status": STATE["status"],
        "startedAt": STATE["startedAt"],
        "finishedAt": STATE["finishedAt"],
        "recordsScanned": result.get("recordsScanned"),
        "error": STATE["error"],
    }


@app.get("/audit/{audit_id}/result")
def audit_result(audit_id: str):
    return _result(audit_id)


# Registered before /records/{record_id} so "search" is not taken as an id.
@app.get("/audit/{audit_id}/records/search")
def records_search(audit_id: str, q: str, limit: int = 10):
    _result(audit_id)
    return {"items": audit.search_records(q, min(limit, 50))}


@app.get("/audit/{audit_id}/records/{record_id}")
def record_detail(audit_id: str, record_id: str):
    _result(audit_id)
    record = audit.get_record(record_id)
    if record is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": f"Record {record_id} does not exist"})
    return record


@app.post("/audit/{audit_id}/rings/{ring_id}/brief")
def ring_brief(audit_id: str, ring_id: str):
    result = _result(audit_id)
    ring = next((r for r in result["rings"] if r["ringId"] == ring_id), None)
    if ring is None:
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": f"Ring {ring_id} does not exist"})
    return brief.build_brief(ring)


@app.get("/stress-test/scenarios")
def stress_scenarios():
    return {"scenarios": stress.SCENARIOS}


@app.post("/audit/{audit_id}/stress-test")
def stress_test(audit_id: str, body: dict = Body(...)):
    result = _result(audit_id)
    out = stress.run(result, body.get("scenario"))
    if out is None:
        raise HTTPException(400, detail={"code": "BAD_REQUEST", "message": "Unknown scenario"})
    return out


@app.get("/dataset/info")
def dataset_info():
    return static.dataset_info()


@app.get("/benchmarks")
def benchmarks():
    return static.benchmarks()


@app.on_event("startup")
def autostart():
    # Our dataset is pre-loaded, so audit it as soon as the service boots.
    _start(None, builtin_dataset())
