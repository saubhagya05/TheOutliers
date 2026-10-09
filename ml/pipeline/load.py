"""Step 1: load the pre-built ledger. Expected columns are listed in ml/data/README.md."""
from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ledger.csv"
DATASET_NAME = "Post-Matric Scholarship 2025-26 (simulated)"


def load_ledger() -> pd.DataFrame:
    # Ground truth lives in truth.csv and must never be read here.
    df = pd.read_csv(
        DATA_PATH,
        dtype={"aadhaar_number": str, "phone": str, "pincode": str, "bank_account_number": str, "upi_id": str, "email": str},
        keep_default_na=False,
    )
    for col in ("registration_ts", "application_ts", "payout_ts"):
        df[col] = pd.to_datetime(df[col], utc=True)
    df["dob"] = pd.to_datetime(df["dob"])
    return df
