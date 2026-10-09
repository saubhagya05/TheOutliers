"""Step 6: explanations. Columns, red-cell anomalies and per-record detail.

Column keys, labels and the to_fields() mapping must match ml/data/build_mock_bundle.py (and
backend/src/mock/data.js) so the frontend tables look the same in mock and live mode. Reuse them.
"""
import pandas as pd

COLUMNS = [
    ("name", "Name", "text"), ("fatherName", "Father", "text"), ("spouseName", "Spouse", "text"),
    ("gender", "Gender", "text"), ("dob", "DOB", "text"), ("age", "Age", "number"),
    ("aadhaarMasked", "Aadhaar", "text"), ("aadhaarStatus", "Aadhaar status", "text"),
    ("biometricHash", "Biometric", "text"), ("phoneMasked", "Phone", "text"), ("email", "Email", "text"),
    ("address", "Address", "text"), ("district", "District", "text"), ("state", "State", "text"),
    ("pincode", "Pincode", "text"), ("registrationIp", "Reg. IP", "text"),
    ("registrationChannel", "Channel", "text"), ("registrationAt", "Registered", "datetime"),
    ("appliedAt", "Applied", "datetime"), ("bankAccount", "Bank account", "text"), ("ifsc", "IFSC", "text"),
    ("upiId", "UPI ID", "text"), ("payoutMode", "Payout mode", "text"), ("amountInr", "Amount", "inr"),
    ("payoutAt", "Paid", "datetime"), ("loginFailed", "Failed logins", "number"),
    ("loginWindowMinutes", "Login window (min)", "number"), ("riskScore", "Risk", "risk"),
]
MEMBER_DEFAULTS = {"name", "fatherName", "dob", "aadhaarMasked", "biometricHash", "phoneMasked", "email", "address",
                   "registrationIp", "registrationAt", "bankAccount", "upiId", "amountInr", "riskScore"}
LONE_DEFAULTS = {"name", "district", "aadhaarMasked", "aadhaarStatus", "phoneMasked", "registrationAt",
                 "loginFailed", "loginWindowMinutes", "amountInr", "riskScore"}


def _columns(defaults):
    return [{"key": k, "label": label, "type": t, "default": k in defaults} for k, label, t in COLUMNS]


def member_columns():
    return _columns(MEMBER_DEFAULTS)


def lone_columns():
    return _columns(LONE_DEFAULTS)


def record_details(df: pd.DataFrame, ring_list: list, lone_list: list) -> dict:
    """recordId -> GET /api/records/:recordId shape (fields, anomalies, columns, reasons,
    features [{key,label,value,typical,anomalous}], kind, ringId, riskScore, riskLevel),
    WITHOUT status / manualOverride / note. Must cover every record, flagged or not."""
    # TODO(ml)
    raise NotImplementedError("record_details")
