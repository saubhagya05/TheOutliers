"""Baseline comparison: what a plain unique-ID check catches vs. our pipeline."""
import pandas as pd


def compare(df: pd.DataFrame, ring_list: list, lone_list: list) -> dict:
    """Return the GET /api/baseline shape.
    Baseline = records whose aadhaarHash appears more than once. It finds no rings by construction.
    `planted` comes from the generator's ground-truth file (counts only, never labels per record)."""
    # TODO(ml)
    raise NotImplementedError("baseline.compare")
