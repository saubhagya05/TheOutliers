"""Step 6: explanations. Columns, field mapping, red-cell anomalies, ring analysis and record details.

Column keys, labels and to_fields() must match ml/data/build_mock_bundle.py and backend/src/mock/data.js,
so the frontend looks the same in mock and live mode.
"""
import hashlib
import re
from collections import Counter, defaultdict

from rapidfuzz import fuzz

from .linkage import BATCH_PHONE_GAP, address_key, name_based
from .util import mask_phone, parse_ts, phone_valid, plural, risk_level

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

SIGNAL_LABELS = {
    "sharedAccount": "Shared bank account", "sharedUpi": "Shared UPI ID", "sharedBiometric": "Shared biometric",
    "sharedIp": "Same registration IP", "registrationBurst": "Registration burst", "batchPhone": "Batch phone numbers",
    "sharedPhone": "Shared phone", "templatedEmail": "Templated emails", "sharedAddress": "Shared address",
    "similarName": "Near-duplicate names", "sameDobFather": "Same DOB and father", "collectorAccount": "Funds sent to a collector",
    "kickbackCycle": "Money cycles back", "invalidAadhaar": "Invalid Aadhaar", "expiredAadhaar": "Expired Aadhaar",
    "invalidPhone": "Invalid phone", "duplicatePhone": "Duplicate phone", "loginBruteforce": "Login brute force",
    "oddHourRegistration": "Odd-hour registration",
}
EMAIL_TEMPLATE = re.compile(r"([a-z]+)\d+@(.+)")


def columns(defaults):
    return [{"key": k, "label": label, "type": t, "default": k in defaults} for k, label, t in COLUMNS]


def member_columns():
    return columns(MEMBER_DEFAULTS)


def lone_columns():
    return columns(LONE_DEFAULTS)


def account_label(r):
    return f'{r["bank_name"]} ****{r["bank_account_number"][-4:]}'


def to_fields(r, risk):
    return {
        "name": r["full_name"], "fatherName": r["father_name"], "spouseName": r["spouse_name"] or None,
        "gender": r["gender"], "dob": r["dob"], "age": int(r["age"]),
        "aadhaarMasked": "XXXX XXXX " + r["aadhaar_number"][-4:], "aadhaarStatus": r["aadhaar_status"],
        "biometricHash": r["biometric_hash"][:10], "phoneMasked": mask_phone(r["phone"]), "email": r["email"] or None,
        "address": f'{r["address_line"]}, {r["village_town"]}', "district": r["district"], "state": r["state"],
        "pincode": r["pincode"], "registrationIp": r["registration_ip"], "registrationChannel": r["registration_channel"],
        "registrationAt": r["registration_ts"], "appliedAt": r["application_ts"],
        "bankAccount": account_label(r), "ifsc": r["ifsc"], "upiId": r["upi_id"] or None,
        "payoutMode": r["payout_mode"], "amountInr": int(r["amount_inr"]), "payoutAt": r["payout_ts"],
        "loginFailed": int(r["login_attempts_failed"]), "loginWindowMinutes": int(r["login_window_minutes"]),
        "riskScore": risk,
    }


def hub_id(kind, value):
    return f"{kind[:3].upper()}-{hashlib.md5(value.encode()).hexdigest()[:6]}"


def external_label(acc, account_names):
    return account_names.get(acc, f"Ext ****{acc[-4:]}")


# ------------------------------------------------------------------ rings

def analyse_ring(ring_id, rows, money, account_names):
    """Recompute every signal inside one group and return anomalies, coverage, hubs, edges and timeline."""
    n = len(rows)
    anomalies = {r["beneficiary_id"]: [] for r in rows}
    carriers = defaultdict(set)
    hubs = {}
    edges = []

    def hub(kind, value, label):
        key = (kind, value)
        if key not in hubs:
            hubs[key] = {"id": hub_id(kind, value), "type": kind, "label": label, "linkedMembers": 0}
        hubs[key]["linkedMembers"] += 1
        return hubs[key]["id"]

    def mark(r, field, signal, label):
        anomalies[r["beneficiary_id"]].append({"field": field, "signal": signal, "label": label})
        carriers[signal].add(r["beneficiary_id"])

    exact = [
        ("bank_account_number", "bankAccount", "sharedAccount", "account", "bank account", lambda v, r: account_label(r)),
        ("upi_id", "upiId", "sharedUpi", "upi", "UPI ID", lambda v, r: v),
        ("biometric_hash", "biometricHash", "sharedBiometric", "biometric", "biometric", lambda v, r: f"Biometric {v[:8]}"),
        ("registration_ip", "registrationIp", "sharedIp", "ip", "registration IP", lambda v, r: v),
        ("phone", "phoneMasked", "sharedPhone", "phone", "phone number", lambda v, r: mask_phone(v)),
    ]
    for col, field, signal, kind, noun, label_of in exact:
        counts = Counter(r[col] for r in rows if r[col])
        for r in rows:
            k = counts.get(r[col], 0)
            if r[col] and k >= 2:
                mark(r, field, signal, f"Same {noun} as {plural(k - 1, 'other member')}")
                edges.append({"source": r["beneficiary_id"], "target": hub(kind, r[col], label_of(r[col], r)), "type": signal, "weight": 1.0})

    by_ip = defaultdict(list)
    for r in rows:
        by_ip[r["registration_ip"]].append(r)
    for group in by_ip.values():
        for r in group:
            near = [o for o in group if abs((parse_ts(o["registration_ts"]) - parse_ts(r["registration_ts"])).total_seconds()) <= 3600]
            if len(near) >= 3:
                mark(r, "registrationAt", "registrationBurst", f"Registered within the same hour as {plural(len(near) - 1, 'other member')} from one IP")

    nums = [(r, int(r["phone"])) for r in rows if phone_valid(r["phone"])]
    for r, v in nums:
        close = [o for o, w in nums if o is not r and 0 < abs(v - w) <= BATCH_PHONE_GAP * 3]
        if close:
            mark(r, "phoneMasked", "batchPhone", f"Phone number in a sequence with {plural(len(close), 'other member')}")
            edges.append({"source": r["beneficiary_id"], "target": hub("phone", f"batch-{ring_id}", f"Phone batch {r['phone'][:5]}…"), "type": "batchPhone", "weight": 0.8})

    tmpl = Counter()
    templated = lambda r: (m := EMAIL_TEMPLATE.fullmatch(r["email"])) and not name_based(m.group(1), r) and m
    for r in rows:
        m = templated(r)
        if m:
            tmpl[(m.group(1), m.group(2))] += 1
    for r in rows:
        m = templated(r)
        if m and tmpl[(m.group(1), m.group(2))] >= 2:
            k = tmpl[(m.group(1), m.group(2))]
            mark(r, "email", "templatedEmail", f"Email follows the template {m.group(1)}###@{m.group(2)} like {plural(k - 1, 'other member')}")
            edges.append({"source": r["beneficiary_id"], "target": hub("email", f"{m.group(1)}@{m.group(2)}", f"{m.group(1)}###@{m.group(2)}"), "type": "templatedEmail", "weight": 0.8})

    akeys = Counter(address_key(r) for r in rows)
    for r in rows:
        k = akeys[address_key(r)]
        same = [o for o in rows if address_key(o) == address_key(r)]
        if k >= 2 and len({o["father_name"].lower() for o in same}) >= 2:
            spelled = len({o["address_line"] for o in same}) > 1
            mark(r, "address", "sharedAddress", f"Same address as {plural(k - 1, 'other member')}{' (spelling differs)' if spelled else ''}")
            edges.append({"source": r["beneficiary_id"], "target": hub("address", address_key(r), f'{r["address_line"]}, {r["village_town"]}'), "type": "sharedAddress", "weight": 0.9})

    for r in rows:
        similar = [o for o in rows if o is not r and o["full_name"] != r["full_name"] and fuzz.ratio(o["full_name"].lower(), r["full_name"].lower()) >= 80]
        if similar:
            mark(r, "name", "similarName", f"Name is a near-duplicate of {similar[0]['full_name']}")
            edges.append({"source": r["beneficiary_id"], "target": similar[0]["beneficiary_id"], "type": "similarName", "weight": 0.7})
        same = [o for o in rows if o is not r and o["dob"] == r["dob"] and fuzz.ratio(o["father_name"].lower(), r["father_name"].lower()) >= 75]
        if same:
            mark(r, "dob", "sameDobFather", f"Same DOB and father as {plural(len(same), 'other member')}")
            anomalies[r["beneficiary_id"]].append({"field": "fatherName", "signal": "sameDobFather", "label": f"Same father as {plural(len(same), 'other member')} born the same day"})

    timeline_money = []
    ids = {r["beneficiary_id"] for r in rows}
    for r in rows:
        rid = r["beneficiary_id"]
        for f in money["forwards"].get(rid, []):
            cid = hub("account", f["to"], f"Collector {external_label(f['to'], account_names)}")
            mark(r, "bankAccount", "collectorAccount",
                 f"Forwarded {f['share']:.0%} of payout to collector {external_label(f['to'], account_names)} {f['minutes']} min after payment")
            edges.append({"source": rid, "target": cid, "type": "transfer", "weight": 1.0, "amountInr": f["amountInr"]})
            timeline_money.append({"at": f["ts"], "event": "transfer", "recordId": rid, "amountInr": f["amountInr"], "to": external_label(f["to"], account_names)})
        for k in money["kickbacks"].get(rid, []):
            mark(r, "bankAccount", "kickbackCycle", f"Received ₹{k['amountInr']:,} back from agent {external_label(k['from'], account_names)}: money cycle")
            aid = hub("account", k["from"], f"Agent {external_label(k['from'], account_names)}")
            edges.append({"source": aid, "target": rid, "type": "transfer", "weight": 1.0, "amountInr": k["amountInr"]})
    for collector, info in money["collectors"].items():
        if ids & set(info["senders"]):
            cid = hub_id("account", collector)
            for src, dst, amount in info["agentTransfers"]:
                aid = hub("account", dst, f"Agent {external_label(dst, account_names)}")
                edges.append({"source": cid, "target": aid, "type": "transfer", "weight": 1.0, "amountInr": amount})

    timeline = sorted(
        [{"at": r["registration_ts"], "event": "registration", "recordId": r["beneficiary_id"]} for r in rows]
        + [{"at": r["payout_ts"], "event": "payout", "recordId": r["beneficiary_id"], "amountInr": int(r["amount_inr"])} for r in rows]
        + timeline_money, key=lambda e: e["at"])
    coverage = {s: len(c) / n for s, c in carriers.items()}
    return {"anomalies": anomalies, "carriers": carriers, "coverage": coverage, "hubs": list(hubs.values()),
            "edges": edges, "timeline": timeline}


def ring_reason_label(signal, carriers, rows_by_id):
    k = len(carriers[signal])
    if signal == "sharedAccount":
        accs = {rows_by_id[i]["bank_account_number"] for i in carriers[signal]}
        return f"{k} members pay out to {'one shared bank account' if len(accs) == 1 else plural(len(accs), 'shared bank account')}"
    return {
        "sharedUpi": f"{k} members route payouts to one UPI ID",
        "sharedBiometric": f"{k} members share a biometric under different names",
        "sharedIp": f"{k} members registered from the same IP",
        "registrationBurst": f"{k} members registered within one hour from one IP",
        "batchPhone": f"{k} members have near-sequential phone numbers",
        "sharedPhone": f"{k} members share a phone number",
        "templatedEmail": f"{k} members use templated emails",
        "sharedAddress": f"{k} members registered at one address",
        "similarName": f"{k} members have near-duplicate names",
        "sameDobFather": f"{k} members share a date of birth and father",
        "collectorAccount": f"{k} members forwarded most of their payout to one collector",
        "kickbackCycle": "Money cycles back: collector → agents → members",
    }.get(signal, SIGNAL_LABELS.get(signal, signal))


# ------------------------------------------------------------------ lone + record detail

def features(r, counts, anomalies, typical):
    has = lambda *s: any(a["signal"] in s for a in anomalies)
    return [
        {"key": "loginFailed", "label": "Failed logins before success", "value": int(r["login_attempts_failed"]), "typical": typical["loginFailed"], "anomalous": has("loginBruteforce")},
        {"key": "loginWindowMinutes", "label": "Login window (minutes)", "value": int(r["login_window_minutes"]), "typical": typical["loginWindowMinutes"], "anomalous": has("loginBruteforce")},
        {"key": "phoneSharedWith", "label": "Other records with this phone", "value": counts["phone"][r["phone"]] - 1, "typical": 0, "anomalous": has("duplicatePhone", "sharedPhone")},
        {"key": "accountSharedWith", "label": "Other records paid to this account", "value": counts["account"][r["bank_account_number"]] - 1, "typical": 0, "anomalous": has("sharedAccount")},
        {"key": "ipSharedWith", "label": "Other records registered from this IP", "value": counts["ip"][r["registration_ip"]] - 1, "typical": 0, "anomalous": has("sharedIp", "registrationBurst")},
        {"key": "registrationHour", "label": "Hour of registration (UTC)", "value": parse_ts(r["registration_ts"]).hour, "typical": typical["registrationHour"], "anomalous": has("oddHourRegistration", "registrationBurst")},
    ]


def record_details(rows, ring_list, lone_list, normal_risk, counts, typical):
    """recordId -> GET /api/records/:recordId shape (without status / manualOverride / note), for every record."""
    all_columns = columns({c[0] for c in COLUMNS})
    flagged = {}
    for ring in ring_list:
        for m in ring["members"]:
            flagged[m["recordId"]] = (m, "ringMember", ring["ringId"], ring["reasons"])
    for item in lone_list:
        flagged.setdefault(item["recordId"], (item, "lone", None, item["topReasons"]))
    details = {}
    for r in rows:
        rid = r["beneficiary_id"]
        if rid in flagged:
            row, kind, ring_id, reasons = flagged[rid]
            risk, fields, anomalies = row["riskScore"], row["fields"], row["anomalies"]
        else:
            kind, ring_id, reasons = "normal", None, normal_risk[rid][1]
            risk = normal_risk[rid][0]
            fields, anomalies = to_fields(r, risk), []
        details[rid] = {
            "recordId": rid, "fields": fields, "anomalies": anomalies, "columns": all_columns, "reasons": reasons,
            "features": features(r, counts, anomalies, typical), "kind": kind, "ringId": ring_id,
            "riskScore": risk, "riskLevel": risk_level(risk),
        }
    return details
