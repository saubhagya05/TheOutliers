"""Step 6: explanations. Columns, red-cell anomalies and per-record detail.

Column keys and labels must match backend/src/mock/generate.js COLUMNS so the frontend tables
look the same in mock and live mode.
"""
import pandas as pd

COLUMNS = [
    ("name", "Name", "text"), ("age", "Age", "number"), ("gender", "Gender", "text"),
    ("phoneMasked", "Phone", "text"), ("address", "Address", "text"), ("district", "District", "text"),
    ("pincode", "Pincode", "text"), ("aadhaarHash", "Aadhaar (hash)", "text"),
    ("payoutAccount", "Payout account", "text"), ("ifsc", "IFSC", "text"),
    ("transferredTo", "Funds moved to", "text"), ("agentId", "Agent", "text"),
    ("deviceId", "OTP device", "text"), ("otpIp", "OTP IP", "text"),
    ("accountOpenedAt", "Account opened", "datetime"), ("appliedAt", "Applied at", "datetime"),
    ("payoutAt", "Paid at", "datetime"), ("amountInr", "Amount", "inr"),
    ("minutesToWithdrawal", "Mins to withdraw", "number"), ("enrolledInRegistry", "In registry", "boolean"),
    ("riskScore", "Risk", "risk"),
]
MEMBER_DEFAULTS = {"name", "phoneMasked", "address", "payoutAccount", "transferredTo", "agentId", "deviceId",
                   "accountOpenedAt", "appliedAt", "amountInr", "minutesToWithdrawal", "riskScore"}
LONE_DEFAULTS = {"name", "district", "payoutAccount", "accountOpenedAt", "appliedAt", "amountInr",
                 "minutesToWithdrawal", "enrolledInRegistry", "riskScore"}


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
