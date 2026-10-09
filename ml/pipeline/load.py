"""Step 1: load the ledger and transfers as plain dicts (strings). Fast enough for 200k+ rows.

Set ML_DATA_DIR to point at another dataset folder (e.g. ml/data/test) without code changes.
Ground truth lives in truth.csv and is never read here.
"""
import csv
import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("ML_DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
DATASET_NAME = "Post-Matric Scholarship 2025-26 (simulated)"
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads"

# Columns an uploaded ledger must have (same as LEDGER_COLUMNS in ml/data/generate_dataset.py).
LEDGER_COLUMNS = [
    "beneficiary_id", "application_id", "scheme",
    "full_name", "father_name", "spouse_name", "gender", "dob", "age",
    "aadhaar_number", "aadhaar_status", "biometric_hash",
    "phone", "email",
    "address_line", "village_town", "district", "state", "pincode",
    "registration_ip", "registration_channel", "registration_ts", "application_ts",
    "bank_name", "bank_account_number", "ifsc", "upi_id", "payout_mode", "amount_inr", "payout_ts",
    "login_attempts_failed", "login_success", "login_window_minutes",
]
TRANSFER_COLUMNS = ["transfer_id", "from_account", "to_account", "amount_inr", "ts", "channel"]


def _read(path: Path) -> list:
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_ledger(data_dir: Path = None) -> list:
    return _read(Path(data_dir or DATA_DIR) / "ledger.csv")


def load_transfers(data_dir: Path = None) -> list:
    """Post-payout money movements: transfer_id, from_account, to_account, amount_inr, ts, channel."""
    path = Path(data_dir or DATA_DIR) / "transfers.csv"
    return _read(path) if path.exists() else []
