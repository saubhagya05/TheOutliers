"""Step 5: lone-ghost scoring and the 2-D scatter projection.

Each rule gives a probability that the record is a ghost; rules are combined with noisy-OR
(1 - product of (1 - p)), so one typo alone stays below the threshold more often than two independent problems.
An Isolation Forest over behaviour features adds a small boost for records that are unusual overall.
Points for the scatter plot come from PCA of the same features.
"""
import random
from collections import Counter, defaultdict

import numpy as np
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest

from . import explain
from .linkage import address_key
from .util import parse_ts, phone_valid, plural, risk_level, verhoeff_valid

LONE_THRESHOLD = 60
RULE_P = {
    "aadhaarFormat": 0.75,       # wrong length / starts with 0 or 1: rarely a typo
    "aadhaarChecksum": 0.52,     # one wrong digit: ghost or genuine typo, needs a second signal
    "expiredAadhaar": 0.5, "deactivatedAadhaar": 0.65,
    "phoneFormat": 0.72,         # 11 digits, bad first digit, all one digit
    "phoneShort": 0.5,           # 9 digits: often a dropped digit at data entry
    "duplicatePhone": 0.5,       # the genuine owner of the number is flagged too, so never enough alone
    "loginFast": 0.72,           # 10+ failures, or 6+ within 10 minutes
    "loginSlow": 0.3,            # 5+ failures over a longer window: often a forgetful user
    "oddHourRegistration": 0.22,
}
IF_MAX_P = 0.15
STRONG = {"invalidAadhaar", "expiredAadhaar", "invalidPhone", "duplicatePhone", "loginBruteforce"}


def feature_matrix(rows, counts):
    return np.array([[
        np.log1p(int(r["login_attempts_failed"])),
        np.log1p(int(r["login_window_minutes"])),
        1.0 if parse_ts(r["registration_ts"]).hour < 6 else 0.0,
        np.log1p(counts["phone"][r["phone"]] - 1),
        np.log1p(counts["ip"][r["registration_ip"]] - 1),
        0.0 if verhoeff_valid(r["aadhaar_number"]) else 1.0,
        0.0 if r["aadhaar_status"] == "active" else 1.0,
        0.0 if phone_valid(r["phone"]) else 1.0,
        1.0 if not r["email"] else 0.0,
    ] for r in rows])


def rule_hits(r, counts, phone_owners):
    """Return [(signal, field, label, p)] for one record."""
    hits = []
    a = r["aadhaar_number"]
    if not verhoeff_valid(a):
        fmt = len(a) != 12 or not a.isdigit() or a[0] in "01"
        hits.append(("invalidAadhaar", "aadhaarMasked",
                     "Aadhaar number has an impossible format" if fmt else "Aadhaar number fails the Verhoeff checksum",
                     RULE_P["aadhaarFormat" if fmt else "aadhaarChecksum"]))
    if r["aadhaar_status"] != "active":
        p = RULE_P["deactivatedAadhaar"] if r["aadhaar_status"] == "deactivated" else RULE_P["expiredAadhaar"]
        hits.append(("expiredAadhaar", "aadhaarStatus", f"Aadhaar is {r['aadhaar_status']} but the payout went through", p))
    phone = r["phone"]
    if not phone_valid(phone):
        short = len(phone) == 9 and phone[0] in "6789"
        hits.append(("invalidPhone", "phoneMasked", f"Phone number is not a valid Indian mobile ({len(phone)} digits"
                     f"{', starts with ' + phone[0] if phone and phone[0] not in '6789' else ''})",
                     RULE_P["phoneShort" if short else "phoneFormat"]))
    others = [o for o in phone_owners[r["phone"]] if o is not r]
    unrelated = [o for o in others if o["father_name"] != r["father_name"] and address_key(o) != address_key(r)]
    if unrelated and len(others) <= 3 and phone_valid(phone):
        hits.append(("duplicatePhone", "phoneMasked", f"Phone number also used by {plural(len(unrelated), 'unrelated record')}", RULE_P["duplicatePhone"]))
    failed, window = int(r["login_attempts_failed"]), int(r["login_window_minutes"])
    if failed >= 10 or (failed >= 6 and window <= 10):
        hits.append(("loginBruteforce", "loginFailed", f"{failed} failed logins in {window} min, then success", RULE_P["loginFast"]))
    elif failed >= 5:
        hits.append(("loginBruteforce", "loginFailed", f"{failed} failed logins in {window} min, then success", RULE_P["loginSlow"]))
    hour = parse_ts(r["registration_ts"])
    if hour.hour < 6:
        hits.append(("oddHourRegistration", "registrationAt", f"Registered at {hour:%H:%M} at night", RULE_P["oddHourRegistration"]))
    return hits


def score_lone(rows, ring_member_ids, counts):
    """Return (lone items in the GET /api/lone item shape without Express fields, normal_risk, features X, kept rows)."""
    candidates = [r for r in rows if r["beneficiary_id"] not in ring_member_ids]
    phone_owners = defaultdict(list)
    for r in rows:
        phone_owners[r["phone"]].append(r)

    x = feature_matrix(candidates, counts)
    forest = IsolationForest(n_estimators=150, random_state=7, contamination="auto").fit(x)
    raw = -forest.score_samples(x)                       # higher = more unusual
    rank = raw.argsort().argsort() / max(1, len(raw) - 1)  # 0..1 percentile

    items, normal_risk = [], {}
    for r, pct in zip(candidates, rank):
        hits = rule_hits(r, counts, phone_owners)
        probs = [p for *_, p in hits]
        if pct > 0.97:
            probs.append(IF_MAX_P * (pct - 0.97) / 0.03)
        score = 1 - np.prod([1 - p for p in probs]) if probs else 0.0
        risk = int(round(100 * score))
        strong = any(h[0] in STRONG for h in hits)
        reasons = sorted(({"signal": s, "label": label, "weight": round(p, 2)} for s, _, label, p in hits), key=lambda d: -d["weight"])
        if risk >= LONE_THRESHOLD and strong:
            anomalies = [{"field": f, "signal": s, "label": label} for s, f, label, _ in hits]
            items.append({"recordId": r["beneficiary_id"], "fields": explain.to_fields(r, risk), "anomalies": anomalies,
                          "riskScore": risk, "riskLevel": risk_level(risk), "topReasons": reasons[:3]})
        else:
            normal_risk[r["beneficiary_id"]] = (min(risk, LONE_THRESHOLD - 1) if risk else 3, reasons[:3])
    items.sort(key=lambda i: -i["riskScore"])
    return items, normal_risk, x, candidates


def points(x, candidates, lone_items, normal_sample=3000, seed=7):
    """Flagged lone records + a sample of normal ones, placed by PCA of the behaviour features (0-1)."""
    flagged = {i["recordId"]: i for i in lone_items}
    rnd = random.Random(seed)
    idx_flagged = [i for i, r in enumerate(candidates) if r["beneficiary_id"] in flagged]
    idx_normal = [i for i, r in enumerate(candidates) if r["beneficiary_id"] not in flagged]
    chosen = idx_flagged + rnd.sample(idx_normal, min(normal_sample, len(idx_normal)))
    sub = x[chosen]
    std = sub.std(axis=0)
    std[std == 0] = 1
    xy = PCA(n_components=2, random_state=7).fit_transform((sub - sub.mean(axis=0)) / std)
    lo, hi = np.percentile(xy, 1, axis=0), np.percentile(xy, 99, axis=0)
    xy = np.clip((xy - lo) / np.where(hi - lo == 0, 1, hi - lo), 0, 1) * 0.94 + 0.03
    out = []
    for (px, py), i in zip(xy, chosen):
        r = candidates[i]
        item = flagged.get(r["beneficiary_id"])
        risk = item["riskScore"] if item else 5
        out.append({"recordId": r["beneficiary_id"], "x": round(float(px), 4), "y": round(float(py), 4), "riskScore": risk,
                    "riskLevel": risk_level(risk), "flagged": bool(item),
                    "topSignal": item["topReasons"][0]["signal"] if item and item["topReasons"] else None})
    return out
