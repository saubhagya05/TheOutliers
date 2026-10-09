"""Step 5: lone-ghost scoring and the 2-D scatter projection.

Plan:
- Rules: newAccount, instantWithdrawal, oddHourApplication, registryMismatch, areaAnomaly, templatedId.
- sklearn IsolationForest over behaviour features (accountAgeDays, minutesToWithdrawal, appliedHour, ...).
- Lone score = weighted rules + isolation score, 0-100. Skip records already in a ring.
- Points: PCA (or UMAP) of the same features to 2-D, normalised to 0-1.
"""
import pandas as pd


def score_lone(df: pd.DataFrame, ring_list: list) -> list:
    """Return lone items in the shape of GET /api/lone items (Record row + topReasons),
    WITHOUT status / manualOverride / note."""
    # TODO(ml)
    raise NotImplementedError("score_lone")


def points(df: pd.DataFrame, lone_list: list) -> list:
    """Every non-ring record as {recordId, x, y, riskScore, riskLevel, flagged, topSignal}."""
    # TODO(ml)
    raise NotImplementedError("points")
