"""Dataset card and benchmark results. Written by the dataset generator / benchmark scripts as JSON."""
import json
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


def _read(name: str) -> dict:
    path = DATA / name
    if not path.exists():
        return {"error": f"{name} not generated yet"}
    return json.loads(path.read_text(encoding="utf-8"))


def dataset_info() -> dict:
    """GET /api/dataset shape, from data/dataset_info.json."""
    return _read("dataset_info.json")


def benchmarks() -> dict:
    """GET /api/benchmarks shape, from data/benchmarks.json."""
    return _read("benchmarks.json")
