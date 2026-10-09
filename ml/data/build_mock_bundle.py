"""Build backend/src/mock/bundle.json from the dev dataset, USING THE GROUND TRUTH.

This is an *oracle*: it shows what a perfect detector's output looks like, in the exact API bundle shape
(docs/API.md section 3), so the frontend can be built on real rows before the real pipeline exists.
UI development only: never report metrics from it. The real detector (ml/pipeline/) must not read truth.csv.

Usage (from repo root): python ml/data/build_mock_bundle.py
"""
import csv
import hashlib
import json
import math
import random
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path

from generate_dataset import phone_valid, verhoeff_valid

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "backend" / "src" / "mock" / "bundle.json"
rnd = random.Random(3)

# ------------------------------------------------------------ shared definitions (keep in sync with docs/API.md)

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

# Ring signal weights for the explainable risk index (oracle version; the real one lives in pipeline/rings.py).
RING_WEIGHTS = {"sharedBiometric": 20, "collectorAccount": 18, "kickbackCycle": 16, "sharedAccount": 16,
                "sharedUpi": 14, "registrationBurst": 12, "batchPhone": 10, "templatedEmail": 10, "sameDobFather": 10,
                "sharedIp": 8, "similarName": 8, "sharedAddress": 8, "sharedPhone": 8}
LONE_WEIGHTS = {"invalidAadhaar": 0.30, "expiredAadhaar": 0.25, "invalidPhone": 0.18, "duplicatePhone": 0.15,
                "loginBruteforce": 0.28, "oddHourRegistration": 0.08}
SIGNAL_LABELS = {
    "sharedAccount": "Shared bank account", "sharedUpi": "Shared UPI ID", "sharedBiometric": "Shared biometric",
    "sharedIp": "Same registration IP", "registrationBurst": "Registration burst", "batchPhone": "Batch phone numbers",
    "sharedPhone": "Shared phone", "templatedEmail": "Templated emails", "sharedAddress": "Shared address",
    "similarName": "Near-duplicate names", "sameDobFather": "Same DOB and father", "collectorAccount": "Funds sent to a collector",
    "kickbackCycle": "Money cycles back", "invalidAadhaar": "Invalid Aadhaar", "expiredAadhaar": "Expired Aadhaar",
    "invalidPhone": "Invalid phone", "duplicatePhone": "Duplicate phone", "loginBruteforce": "Login brute force",
    "oddHourRegistration": "Odd-hour registration",
}


def columns(defaults):
    return [{"key": k, "label": label, "type": t, "default": k in defaults} for k, label, t in COLUMNS]


def mask_phone(p):
    return p[:4] + "X" * max(0, len(p) - 6) + p[-2:] if len(p) >= 6 else "X" * len(p)


def to_fields(r, risk):
    acc = r["bank_account_number"]
    return {
        "name": r["full_name"], "fatherName": r["father_name"], "spouseName": r["spouse_name"] or None,
        "gender": r["gender"], "dob": r["dob"], "age": int(r["age"]),
        "aadhaarMasked": "XXXX XXXX " + r["aadhaar_number"][-4:], "aadhaarStatus": r["aadhaar_status"],
        "biometricHash": r["biometric_hash"][:10], "phoneMasked": mask_phone(r["phone"]), "email": r["email"] or None,
        "address": f'{r["address_line"]}, {r["village_town"]}', "district": r["district"], "state": r["state"],
        "pincode": r["pincode"], "registrationIp": r["registration_ip"], "registrationChannel": r["registration_channel"],
        "registrationAt": r["registration_ts"], "appliedAt": r["application_ts"],
        "bankAccount": f'{r["bank_name"]} ****{acc[-4:]}', "ifsc": r["ifsc"], "upiId": r["upi_id"] or None,
        "payoutMode": r["payout_mode"], "amountInr": int(r["amount_inr"]), "payoutAt": r["payout_ts"],
        "loginFailed": int(r["login_attempts_failed"]), "loginWindowMinutes": int(r["login_window_minutes"]),
        "riskScore": risk,
    }


def level(score):
    return "high" if score >= 70 else "medium" if score >= 40 else "low"


def hid(kind, value):
    return f"{kind[:3].upper()}-{hashlib.md5(value.encode()).hexdigest()[:6]}"


def t(ts):
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")


def plural(n, word):
    return f"{n} {word}{'' if n == 1 else 's'}"


def similar(a, b, threshold=0.8):
    return a != b and SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold


def addr_key(r):
    digits = re.findall(r"\d+", r["address_line"])
    return f'{r["pincode"]}|{r["village_town"]}|{digits[0] if digits else r["address_line"]}'


# ------------------------------------------------------------ load

def load(name):
    with open(HERE / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


ledger = load("ledger.csv")
truth = {r["beneficiary_id"]: r for r in load("truth.csv")}
transfers = load("transfers.csv")
planted = json.loads((HERE / "planted.json").read_text(encoding="utf-8"))
by_id = {r["beneficiary_id"]: r for r in ledger}
out_of = defaultdict(list)
for x in transfers:
    out_of[x["from_account"]].append(x)
phone_count = Counter(r["phone"] for r in ledger)
acct_name = {r["bank_account_number"]: f'{r["bank_name"]} ****{r["bank_account_number"][-4:]}' for r in ledger}


def acct_label(acc):
    return acct_name.get(acc, f"Ext ****{acc[-4:]}")


# ------------------------------------------------------------ rings

def analyse_ring(ring_id, rows, decoy=False):
    n = len(rows)
    anomalies = {r["beneficiary_id"]: [] for r in rows}
    carriers = defaultdict(set)
    hubs = {}
    edges = []

    def hub(kind, value, label):
        key = (kind, value)
        if key not in hubs:
            hubs[key] = {"id": hid(kind, value), "type": kind, "label": label, "linkedMembers": 0}
        hubs[key]["linkedMembers"] += 1
        return hubs[key]["id"]

    def mark(r, field, signal, label):
        anomalies[r["beneficiary_id"]].append({"field": field, "signal": signal, "label": label})
        carriers[signal].add(r["beneficiary_id"])

    exact = [
        ("bank_account_number", "bankAccount", "sharedAccount", "account", "bank account", acct_label),
        ("upi_id", "upiId", "sharedUpi", "upi", "UPI ID", lambda v: v),
        ("biometric_hash", "biometricHash", "sharedBiometric", "biometric", "biometric", lambda v: f"Biometric {v[:8]}"),
        ("registration_ip", "registrationIp", "sharedIp", "ip", "registration IP", lambda v: v),
        ("phone", "phoneMasked", "sharedPhone", "phone", "phone number", mask_phone),
    ]
    for col, field, signal, kind, noun, label_of in exact:
        counts = Counter(r[col] for r in rows if r[col])
        for r in rows:
            k = counts.get(r[col], 0)
            if r[col] and k >= 2:
                mark(r, field, signal, f"Same {noun} as {plural(k - 1, 'other member')}")
                edges.append({"source": r["beneficiary_id"], "target": hub(kind, r[col], label_of(r[col])), "type": signal, "weight": 1.0})

    # registration burst: 3+ members from the same IP within one hour
    by_ip = defaultdict(list)
    for r in rows:
        by_ip[r["registration_ip"]].append(r)
    for group in by_ip.values():
        for r in group:
            near = [o for o in group if abs((t(o["registration_ts"]) - t(r["registration_ts"])).total_seconds()) <= 3600]
            if len(near) >= 3:
                mark(r, "registrationAt", "registrationBurst", f"Registered within the same hour as {plural(len(near) - 1, 'other member')} from one IP")

    # batch phones: valid, distinct, within 30 of another member's number
    nums = [(r, int(r["phone"])) for r in rows if phone_valid(r["phone"])]
    for r, v in nums:
        close = [o for o, w in nums if o is not r and 0 < abs(v - w) <= 30]
        if close:
            mark(r, "phoneMasked", "batchPhone", f"Phone number in a sequence with {plural(len(close), 'other member')}")
            edges.append({"source": r["beneficiary_id"], "target": hub("phone", f"batch-{ring_id}", f"Phone batch {r['phone'][:5]}…"), "type": "batchPhone", "weight": 0.8})

    # templated emails: same prefix + domain, digits differ
    tmpl = Counter()
    for r in rows:
        m = re.fullmatch(r"([a-z]+)\d+@(.+)", r["email"])
        if m:
            tmpl[(m.group(1), m.group(2))] += 1
    for r in rows:
        m = re.fullmatch(r"([a-z]+)\d+@(.+)", r["email"])
        if m and tmpl[(m.group(1), m.group(2))] >= 2:
            k = tmpl[(m.group(1), m.group(2))]
            mark(r, "email", "templatedEmail", f"Email follows the template {m.group(1)}###@{m.group(2)} like {plural(k - 1, 'other member')}")
            edges.append({"source": r["beneficiary_id"], "target": hub("email", f"{m.group(1)}@{m.group(2)}", f"{m.group(1)}###@{m.group(2)}"), "type": "templatedEmail", "weight": 0.8})

    # shared address (normalised: pincode + town + house number), so "House 12, Ward 4" == "H.No. 12, Wd 4"
    akeys = Counter(addr_key(r) for r in rows)
    for r in rows:
        k = akeys[addr_key(r)]
        if k >= 2:
            mark(r, "address", "sharedAddress", f"Same address as {plural(k - 1, 'other member')} (spelling differs)" if
                 len({o["address_line"] for o in rows if addr_key(o) == addr_key(r)}) > 1 else f"Same address as {plural(k - 1, 'other member')}")
            edges.append({"source": r["beneficiary_id"], "target": hub("address", addr_key(r), f'{r["address_line"]}, {r["village_town"]}'), "type": "sharedAddress", "weight": 0.9})

    # near-duplicate names and same DOB + father
    for r in rows:
        twins = [o for o in rows if similar(o["full_name"], r["full_name"])]
        if twins:
            mark(r, "name", "similarName", f"Name is a near-duplicate of {twins[0]['full_name']}")
            edges.append({"source": r["beneficiary_id"], "target": twins[0]["beneficiary_id"], "type": "similarName", "weight": 0.7})
        same = [o for o in rows if o is not r and o["dob"] == r["dob"] and (o["father_name"] == r["father_name"] or similar(o["father_name"], r["father_name"], 0.75))]
        if same:
            mark(r, "dob", "sameDobFather", f"Same DOB and father as {plural(len(same), 'other member')}")
            anomalies[r["beneficiary_id"]].append({"field": "fatherName", "signal": "sameDobFather", "label": f"Same father as {plural(len(same), 'other member')} born the same day"})

    # money: collector fan-in and kickback cycles
    accounts = {r["bank_account_number"]: r for r in rows}
    sent = defaultdict(list)
    for acc in accounts:
        for x in out_of[acc]:
            if x["to_account"] not in accounts:
                sent[x["to_account"]].append(x)
    timeline_money = []
    for collector, xs in sent.items():
        senders = {x["from_account"] for x in xs}
        if len(senders) < 3:
            continue
        cid = hub("account", collector, f"Collector {acct_label(collector)}")
        for x in xs:
            r = accounts[x["from_account"]]
            share = int(x["amount_inr"]) / int(r["amount_inr"])
            mins = int((t(x["ts"]) - t(r["payout_ts"])).total_seconds() // 60)
            mark(r, "bankAccount", "collectorAccount", f"Forwarded {share:.0%} of payout to collector {acct_label(collector)} {mins} min after payment")
            edges.append({"source": r["beneficiary_id"], "target": cid, "type": "transfer", "weight": 1.0, "amountInr": int(x["amount_inr"])})
            timeline_money.append({"at": x["ts"], "event": "transfer", "recordId": r["beneficiary_id"], "amountInr": int(x["amount_inr"]), "to": acct_label(collector)})
        for y in out_of[collector]:
            aid = hub("account", y["to_account"], f"Agent {acct_label(y['to_account'])}")
            edges.append({"source": cid, "target": aid, "type": "transfer", "weight": 1.0, "amountInr": int(y["amount_inr"])})
            for z in out_of[y["to_account"]]:
                if z["to_account"] in accounts:
                    r = accounts[z["to_account"]]
                    mark(r, "bankAccount", "kickbackCycle", f"Received ₹{int(z['amount_inr']):,} back from agent {acct_label(y['to_account'])}: money cycle")
                    edges.append({"source": aid, "target": r["beneficiary_id"], "type": "transfer", "weight": 1.0, "amountInr": int(z["amount_inr"])})

    coverage = {s: len(ids) / n for s, ids in carriers.items()}
    if not coverage:
        return None
    risk = min(98, round(42 + sum(RING_WEIGHTS.get(s, 6) * c for s, c in coverage.items()) + rnd.randint(-3, 3)))
    if decoy:
        risk = rnd.randint(30, 38)
    total = sum(RING_WEIGHTS.get(s, 6) * c for s, c in coverage.items())
    ordered = sorted(coverage, key=lambda s: -RING_WEIGHTS.get(s, 6) * coverage[s])

    def ring_label(s):
        k = len(carriers[s])
        if s == "sharedAccount":
            accs = {by_id[i]["bank_account_number"] for i in carriers[s]}
            return f"{k} members pay out to {'one shared bank account' if len(accs) == 1 else plural(len(accs), 'shared bank account')}"
        return {
            "sharedUpi": f"{k} members route payouts to one UPI ID",
            "sharedBiometric": f"{k} members share a biometric under different names",
            "sharedIp": f"{k} members registered from the same IP",
            "registrationBurst": f"{k} members registered within one hour from one IP",
            "batchPhone": f"{k} members have near-sequential phone numbers",
            "sharedPhone": f"{k} members share a phone number",
            "templatedEmail": f"{k} members use templated disposable emails",
            "sharedAddress": f"{k} members registered at one address",
            "similarName": f"{k} members have near-duplicate names",
            "sameDobFather": f"{k} members share a date of birth and father",
            "collectorAccount": f"{k} members forwarded most of their payout to one collector",
            "kickbackCycle": "Money cycles back: collector → agents → members",
        }.get(s, SIGNAL_LABELS.get(s, s))

    reasons = [{"signal": s, "label": ring_label(s), "weight": round(RING_WEIGHTS.get(s, 6) * coverage[s] / total, 2)} for s in ordered]
    members = []
    for r in rows:
        m_risk = max(20, min(99, risk + rnd.randint(-6, 4) - (8 if not anomalies[r["beneficiary_id"]] else 0)))
        members.append({"recordId": r["beneficiary_id"], "fields": to_fields(r, m_risk), "anomalies": anomalies[r["beneficiary_id"]],
                        "riskScore": m_risk, "riskLevel": level(m_risk)})
    amount = sum(int(r["amount_inr"]) for r in rows)
    district = Counter(r["district"] for r in rows).most_common(1)[0][0]
    nodes = [{"id": r["beneficiary_id"], "type": "beneficiary", "label": r["full_name"], "ringId": ring_id, "riskScore": m["riskScore"]}
             for r, m in zip(rows, members)]
    nodes += [{"id": h["id"], "type": h["type"], "label": h["label"], "ringId": ring_id, "riskScore": risk} for h in hubs.values()]
    timeline = sorted(
        [{"at": r["registration_ts"], "event": "registration", "recordId": r["beneficiary_id"]} for r in rows]
        + [{"at": r["payout_ts"], "event": "payout", "recordId": r["beneficiary_id"], "amountInr": int(r["amount_inr"])} for r in rows]
        + timeline_money, key=lambda e: e["at"])
    top = "; ".join(x["label"][0].lower() + x["label"][1:] for x in reasons[:3])
    summary = (f"{n} beneficiaries in {district} share a CSC centre or family ties. The pattern looks legitimate, so the score is low; verify before acting."
               if decoy else f"{n} beneficiaries in {district} with different names and Aadhaar numbers are linked: {top}. ₹{amount / 100000:.1f} lakh is at risk.")
    return {
        "ringId": ring_id, "riskScore": risk, "riskLevel": level(risk), "district": district, "ringType": ordered[0],
        "memberCount": n, "amountAtRiskInr": amount, "summary": summary, "reasons": reasons, "topReasons": reasons[:3],
        "signalBreakdown": [{"signal": s, "label": SIGNAL_LABELS[s], "value": round(coverage[s], 2)} for s in ordered],
        "sharedEntities": sorted(hubs.values(), key=lambda h: -h["linkedMembers"]),
        "graph": {"nodes": nodes, "edges": edges}, "timeline": timeline, "columns": columns(MEMBER_DEFAULTS),
        "members": members,
    }


ring_rows = defaultdict(list)
for r in ledger:
    if truth[r["beneficiary_id"]]["ring_id"]:
        ring_rows[truth[r["beneficiary_id"]]["ring_id"]].append(r)
rings = []
for i, (_, rows) in enumerate(sorted(ring_rows.items())):
    ring = analyse_ring(f"R-{i + 1:03d}", rows)
    if ring:
        rings.append(ring)

# Two legitimate clusters a detector would also surface (low risk): good for the deflag demo.
csc_groups = defaultdict(list)
for r in ledger:
    if truth[r["beneficiary_id"]]["label"] == "normal" and r["registration_channel"] == "CSC":
        csc_groups[r["registration_ip"]].append(r)
fam_groups = defaultdict(list)
for r in ledger:
    if "family_shared_account" in truth[r["beneficiary_id"]]["hard_negative"]:
        fam_groups[truth[r["beneficiary_id"]]["household_id"]].append(r)
decoys = [sorted(next(iter(csc_groups.values())), key=lambda r: r["registration_ts"])[:8]]
for hh, members in fam_groups.items():
    head = [r for r in ledger if truth[r["beneficiary_id"]]["household_id"] == hh]
    if len(head) >= 3:
        decoys.append(head)
        break
for rows in decoys:
    ring = analyse_ring(f"R-{len(rings) + 1:03d}", rows, decoy=True)
    if ring:
        rings.append(ring)

# investigation priority
max_amount = max(r["amountAtRiskInr"] for r in rings)
for r in rings:
    effort = "low" if r["memberCount"] <= 8 else "high" if r["memberCount"] >= 14 else "medium"
    recoverable = round(r["amountAtRiskInr"] * (0.1 if r["riskScore"] < 40 else rnd.uniform(0.6, 0.95)) / 1000) * 1000
    r["priority"] = {"priorityScore": min(100, round(recoverable / max_amount * 70 + {"low": 30, "medium": 18, "high": 6}[effort])),
                     "rank": 0, "recoverableInr": recoverable, "effort": effort}
for rank, r in enumerate(sorted(rings, key=lambda r: -r["priority"]["priorityScore"]), start=1):
    r["priority"]["rank"] = rank
ring_member_ids = {m["recordId"] for r in rings for m in r["members"]}

# ------------------------------------------------------------ lone ghosts

def lone_anomalies(r, traits):
    a = []
    if "invalid_aadhaar" in traits or "aadhaar_typo" in traits:
        a.append({"field": "aadhaarMasked", "signal": "invalidAadhaar", "label": "Aadhaar number fails the Verhoeff checksum or format check"})
    if "expired_aadhaar" in traits or "aadhaar_pending_update" in traits:
        a.append({"field": "aadhaarStatus", "signal": "expiredAadhaar", "label": f"Aadhaar is {r['aadhaar_status']} but the payout went through"})
    if "invalid_phone" in traits or "phone_typo" in traits:
        a.append({"field": "phoneMasked", "signal": "invalidPhone", "label": f"Phone number is not a valid Indian mobile ({len(r['phone'])} digits)"})
    if "duplicate_phone" in traits:
        a.append({"field": "phoneMasked", "signal": "duplicatePhone", "label": f"Phone number also used by {plural(phone_count[r['phone']] - 1, 'unrelated record')}"})
    if "login_bruteforce" in traits or "forgetful_login" in traits:
        a.append({"field": "loginFailed", "signal": "loginBruteforce", "label": f"{r['login_attempts_failed']} failed logins in {r['login_window_minutes']} min, then success"})
    if t(r["registration_ts"]).hour < 6:
        a.append({"field": "registrationAt", "signal": "oddHourRegistration", "label": f"Registered at {t(r['registration_ts']):%H:%M} at night"})
    return a


lone = []
lookalike_tags = ("phone_typo", "aadhaar_typo", "aadhaar_pending_update", "forgetful_login")
lookalikes = [r for r in ledger if any(x in truth[r["beneficiary_id"]]["hard_negative"] for x in lookalike_tags)]
for r in [r for r in ledger if truth[r["beneficiary_id"]]["label"] == "lone"] + rnd.sample(lookalikes, min(15, len(lookalikes))):
    tr = truth[r["beneficiary_id"]]
    is_ghost = tr["label"] == "lone"
    traits = tr["ghost_traits"] if is_ghost else tr["hard_negative"]
    anomalies = lone_anomalies(r, traits)
    score = sum(LONE_WEIGHTS[a["signal"]] for a in anomalies)
    risk = min(97, round(35 + score * 90 + rnd.randint(0, 8))) if is_ghost else rnd.randint(40, 54)
    reasons = sorted(({"signal": a["signal"], "label": a["label"], "weight": LONE_WEIGHTS[a["signal"]]} for a in anomalies), key=lambda x: -x["weight"])
    lone.append({"recordId": r["beneficiary_id"], "fields": to_fields(r, risk), "anomalies": anomalies, "riskScore": risk,
                 "riskLevel": level(risk), "topReasons": reasons[:3]})
lone_ids = {x["recordId"] for x in lone}

# ------------------------------------------------------------ scatter points (oracle projection: direction = top signal)

ANGLE = {"invalidAadhaar": 0.3, "expiredAadhaar": 1.5, "invalidPhone": 2.6, "duplicatePhone": 3.6, "loginBruteforce": 4.8, "oddHourRegistration": 5.6}
gauss = lambda: (rnd.random() + rnd.random() + rnd.random() - 1.5) / 1.5
clamp = lambda v: max(0.02, min(0.98, v))
points = []
for x in lone:
    sig = x["topReasons"][0]["signal"] if x["topReasons"] else "oddHourRegistration"
    ang = ANGLE[sig] + rnd.uniform(-0.35, 0.35)
    rad = 0.18 + x["riskScore"] / 100 * 0.25
    points.append({"recordId": x["recordId"], "x": round(clamp(0.5 + math.cos(ang) * rad), 4), "y": round(clamp(0.5 + math.sin(ang) * rad), 4),
                   "riskScore": x["riskScore"], "riskLevel": x["riskLevel"], "flagged": True, "topSignal": sig})
normals = [r for r in ledger if r["beneficiary_id"] not in ring_member_ids and r["beneficiary_id"] not in lone_ids]
for r in rnd.sample(normals, 3000):
    risk = rnd.randint(1, 25)
    points.append({"recordId": r["beneficiary_id"], "x": round(clamp(0.5 + gauss() * 0.13), 4), "y": round(clamp(0.5 + gauss() * 0.13), 4),
                   "riskScore": risk, "riskLevel": "low", "flagged": False, "topSignal": None})

# ------------------------------------------------------------ baseline and bundle

aadhaar_count = Counter(r["aadhaar_number"] for r in ledger)
dup_aadhaar = [r for r in ledger if aadhaar_count[r["aadhaar_number"]] > 1]
real_rings = [r for r in rings if r["riskScore"] >= 40]
ring_amount = sum(r["amountAtRiskInr"] for r in real_rings)
lone_amount = sum(x["fields"]["amountInr"] for x in lone if x["riskScore"] >= 55)
baseline = {
    "baseline": {"method": "Unique Aadhaar / ID check", "recordsFlagged": len(dup_aadhaar), "ringsDetected": 0,
                 "amountCaughtInr": sum(int(r["amount_inr"]) for r in dup_aadhaar), "flaggedRecordIds": [r["beneficiary_id"] for r in dup_aadhaar]},
    "ours": {"method": "Graph linkage + behaviour scoring", "recordsFlagged": sum(r["memberCount"] for r in real_rings) + len(lone),
             "ringsDetected": len(real_rings), "amountCaughtInr": ring_amount + lone_amount},
    "planted": {"rings": planted["rings"], "loneGhosts": planted["loneGhosts"]},
    "headline": f"The unique-ID check catches 0 of {planted['rings']} rings. Our graph surfaces {len(real_rings)}.",
}

context = [{"id": r["beneficiary_id"], "type": "beneficiary", "label": r["full_name"], "ringId": None, "riskScore": rnd.randint(1, 25)}
           for r in rnd.sample(normals, 2000)]

bundle = {
    "auditId": "AUD-ORACLE",
    "oracle": True,
    "finishedAt": planted["generatedAt"],
    "datasetName": "Post-Matric Scholarship 2025-26 (simulated)",
    "recordsScanned": len(ledger),
    "transfersScanned": len(transfers),
    "auditDurationSeconds": None,
    "memberColumns": columns(MEMBER_DEFAULTS),
    "loneColumns": columns(LONE_DEFAULTS),
    "rings": rings,
    "contextNodes": context,
    "lone": lone,
    "points": points,
    "baseline": baseline,
}
OUT.write_text(json.dumps(bundle, ensure_ascii=False), encoding="utf-8")
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB): {len(rings)} rings, {len(lone)} lone, {len(points)} points")
print("ring risk:", sorted(r["riskScore"] for r in rings))
