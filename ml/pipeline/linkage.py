"""Step 2: record linkage. Find pairs of records that share or nearly share an attribute.

Plan:
- Blocking: compare only within the same pincode / phone prefix / name initials.
- Exact keys: payoutAccount, phone, deviceId, otpIp, agentId, address, transferredTo.
- Fuzzy names: rapidfuzz Jaro-Winkler + jellyfish metaphone within a block.
"""
import pandas as pd


def link_records(df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame of links with columns:
    source (recordId), target (recordId or hub id), signal (see API.md signal values), weight (0-1).
    """
    # TODO(ml)
    raise NotImplementedError("link_records")
