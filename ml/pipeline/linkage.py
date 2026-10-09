"""Step 2: record linkage. Find pairs of records that share or nearly share an attribute.

Plan:
- Blocking: compare only within the same pincode / phone prefix / name initials.
- Exact keys (ignore empty strings): bank_account_number, upi_id, biometric_hash, phone, registration_ip.
- Near keys: phone numbers within 30 of each other (batch), email template (letters + digits @ same domain),
  normalised address (pincode + town + house number).
- Fuzzy names: rapidfuzz Levenshtein / Jaro-Winkler + jellyfish metaphone within a block; same dob + similar father.
- Discount legitimate sharing: same surname + father (family), registration_channel == CSC for shared IPs.
"""
import pandas as pd


def link_records(df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame of links with columns:
    source (recordId), target (recordId or hub id), signal (see API.md signal values), weight (0-1).
    """
    # TODO(ml)
    raise NotImplementedError("link_records")
