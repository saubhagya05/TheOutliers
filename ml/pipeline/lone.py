"""Step 5: lone-ghost scoring and the 2-D scatter projection.

Plan:
- Rules: invalidAadhaar (generate_dataset.verhoeff_valid), expiredAadhaar, invalidPhone (phone_valid),
  duplicatePhone (shared with an unrelated record, not family), loginBruteforce, oddHourRegistration (weak).
- No single rule is decisive (genuine typos and forgetful users exist): combine them, optionally with
  sklearn IsolationForest over login_attempts_failed, login_window_minutes, registration hour, phone/IP share counts.
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
