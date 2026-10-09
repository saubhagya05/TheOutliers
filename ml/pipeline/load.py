"""Step 1: load the pre-built ledger. Expected columns are listed in ml/data/README.md."""
from pathlib import Path

import pandas as pd

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "ledger.csv"
DATASET_NAME = "Post-Matric Scholarship 2025-26 (simulated)"


def load_ledger() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, parse_dates=["accountOpenedAt", "appliedAt", "payoutAt"])
    # Ground-truth columns (is_ghost, ring_label) must never reach the detector.
    return df.drop(columns=[c for c in ("is_ghost", "ring_label", "ghost_type") if c in df.columns])
