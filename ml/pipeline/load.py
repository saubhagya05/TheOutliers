"""Step 1: load the ledger and transfers as plain dicts (strings). Fast enough for 200k+ rows.

Set ML_DATA_DIR to point at another dataset folder (e.g. ml/data/test) without code changes.
Ground truth lives in truth.csv and is never read here.
"""
import csv
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("ML_DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
DATASET_NAME = "Post-Matric Scholarship 2025-26 (simulated)"


def _read(path: Path) -> list:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_ledger(data_dir: Path = None) -> list:
    return _read(Path(data_dir or DATA_DIR) / "ledger.csv")


def load_transfers(data_dir: Path = None) -> list:
    """Post-payout money movements: transfer_id, from_account, to_account, amount_inr, ts, channel."""
    path = Path(data_dir or DATA_DIR) / "transfers.csv"
    return _read(path) if path.exists() else []
