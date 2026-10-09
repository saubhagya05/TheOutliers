"""ML service. Contract: docs/API.md section 3. Only Express calls this.

Run:  uvicorn app:app --reload --port 8000
"""
import threading
from datetime import datetime, timezone

from fastapi import Body, FastAPI, HTTPException

from pipeline import audit, brief, stress, static

app = FastAPI(title="TheOutliers ML")

STATE = {"auditId": None, "status": "idle", "startedAt": None, "finishedAt": None, "result": None, "error": None}
_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _run(audit_id: str):
    try:
        result = audit.run_audit(audit_id)
        with _lock:
            STATE.update(status="done", finishedAt=_now(), result=result)
    except Exception as exc:  # surfaced via GET /audit/{id}
        with _lock:
            STATE.update(status="failed", error=str(exc))
        raise


def _result(audit_id: str):
    if STATE["auditId"] != audit_id or STATE["status"] != "done":
        raise HTTPException(404, detail={"code": "NOT_FOUND", "message": f"Audit {audit_id} not ready"})
    return STATE["result"]


@app.get("/health")
def health():
    return {"status": "ok", "auditReady": STATE["status"] == "done", "auditId": STATE["auditId"]}


@app.post("/audit/run")
def run_audit(body: dict = Body(default={})):
    with _lock:
        if STATE["status"] == "running" or (STATE["status"] == "done" and not body.get("force")):
            return {"auditId": STATE["auditId"], "status": STATE["status"]}
        audit_id = f"AUD-{datetime.now(timezone.utc):%H%M%S}"
        STATE.update(auditId=audit_id, status="running", startedAt=_now(), finishedAt=None, result=None, error=None)
    threading.Thread(target=_run, args=(audit_id,), daemon=True).start()
    return {"auditId": audit_id, "status": "running"}


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
    # The dataset is pre-loaded, so start the audit as soon as the service boots.
    run_audit({})
