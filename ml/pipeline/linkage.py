"""Step 2: record linkage. Finds groups of records that share (or nearly share) something.

Each group is a "hub": a bank account, UPI ID, biometric, phone, IP burst, phone batch, email template,
address, or a near-duplicate identity (Levenshtein + phonetic name, same DOB, similar father).

Context-aware discounting keeps legitimate sharing out:
- family hubs (everyone shares surname + father) are dropped,
- public hubs (shared by very many people, e.g. CSC centre IPs) are dropped,
- IPs only count as a burst when 3+ registrations land within 60 minutes.
"""
import re
from collections import defaultdict
from datetime import datetime

import jellyfish
from rapidfuzz import fuzz

from .util import parse_ts, phone_valid

PUBLIC_HUB_SIZE = 30          # more people than this sharing one value = public infrastructure, not a ring
BURST_WINDOW_S = 3600
BATCH_PHONE_GAP = 10
NAME_SIMILARITY = 85
FATHER_SIMILARITY = 75
EMAIL_TEMPLATE = re.compile(r"([a-z]+)(\d+)@(.+)")

# Base strength of each kind of shared evidence (before inverse-frequency weighting).
SIGNAL_WEIGHT = {
    "sharedBiometric": 1.0, "sharedAccount": 0.9, "sharedUpi": 0.9, "collectorAccount": 1.0,
    "registrationBurst": 0.8, "batchPhone": 0.7, "templatedEmail": 0.7, "sameDobFather": 0.7,
    "sharedPhone": 0.6, "sharedIp": 0.5, "sharedAddress": 0.5,
}


def surname(r):
    return r["full_name"].split()[-1].lower()


def is_family(rows) -> bool:
    """Everyone shares a surname and father (or the address): treat as one household, not a ring."""
    fathers = {r["father_name"].lower() for r in rows}
    surnames = {surname(r) for r in rows}
    addresses = {address_key(r) for r in rows}
    return len(fathers) == 1 and (len(surnames) == 1 or len(addresses) == 1)


def address_key(r) -> str:
    digits = re.findall(r"\d+", r["address_line"])
    return f'{r["pincode"]}|{r["village_town"].lower()}|{digits[0] if digits else r["address_line"].lower()}'


def _hub(signal, key, members, label, kind):
    return {"signal": signal, "key": key, "members": members, "label": label, "kind": kind,
            "weight": SIGNAL_WEIGHT[signal]}


def exact_hubs(rows):
    specs = [
        ("bank_account_number", "sharedAccount", "account"),
        ("upi_id", "sharedUpi", "upi"),
        ("biometric_hash", "sharedBiometric", "biometric"),
        ("phone", "sharedPhone", "phone"),
    ]
    hubs = []
    for col, signal, kind in specs:
        groups = defaultdict(list)
        for r in rows:
            if r[col] and (col != "phone" or phone_valid(r[col])):  # placeholder phones (0000000000) link nobody
                groups[r[col]].append(r)
        for value, members in groups.items():
            if 2 <= len(members) <= PUBLIC_HUB_SIZE and not is_family(members):
                hubs.append(_hub(signal, f"{kind}:{value}", [m["beneficiary_id"] for m in members], value, kind))
    return hubs


def ip_hubs(rows):
    """Shared non-public IPs, plus burst windows (3+ registrations within an hour from one IP)."""
    groups = defaultdict(list)
    for r in rows:
        groups[r["registration_ip"]].append(r)
    hubs = []
    for ip, members in groups.items():
        if len(members) < 2 or len(members) > PUBLIC_HUB_SIZE or is_family(members):
            continue
        # A CSC centre's IP is shared by design; don't rely on size alone (small datasets have small CSC groups).
        if sum(m["registration_channel"] == "CSC" for m in members) * 2 >= len(members):
            continue
        hubs.append(_hub("sharedIp", f"ip:{ip}", [m["beneficiary_id"] for m in members], ip, "ip"))
        members = sorted(members, key=lambda m: m["registration_ts"])
        times = [parse_ts(m["registration_ts"]).timestamp() for m in members]
        start = 0
        best = []
        for end in range(len(members)):
            while times[end] - times[start] > BURST_WINDOW_S:
                start += 1
            if end - start + 1 > len(best):
                best = members[start:end + 1]
        if len(best) >= 3:
            hubs.append(_hub("registrationBurst", f"burst:{ip}", [m["beneficiary_id"] for m in best], ip, "ip"))
    return hubs


def batch_phone_hubs(rows):
    """Sorted-neighbourhood: chain valid numbers that are at most BATCH_PHONE_GAP apart."""
    nums = sorted(((int(r["phone"]), r) for r in rows if phone_valid(r["phone"])), key=lambda x: x[0])
    hubs, chain = [], []
    for value, r in nums:
        if chain and 0 < value - chain[-1][0] <= BATCH_PHONE_GAP:
            chain.append((value, r))
            continue
        if chain and value == chain[-1][0]:
            continue  # exact duplicates are handled by sharedPhone
        if len(chain) >= 3:
            hubs.append(chain)
        chain = [(value, r)]
    if len(chain) >= 3:
        hubs.append(chain)
    return [_hub("batchPhone", f"batch:{c[0][0]}", [r["beneficiary_id"] for _, r in c],
                 f"Phone batch {str(c[0][0])[:5]}…", "phone") for c in hubs if not is_family([r for _, r in c])]


def name_based(prefix: str, r) -> bool:
    """rahulkumar12@ for Rahul Kumar is an ordinary personal email, not a template."""
    parts = [p.lower() for p in r["full_name"].split() if len(p) > 2]
    return any(p in prefix for p in parts)


def email_template_hubs(rows):
    groups = defaultdict(list)
    for r in rows:
        m = EMAIL_TEMPLATE.fullmatch(r["email"])
        if m and not name_based(m.group(1), r):
            groups[(m.group(1), m.group(3))].append((int(m.group(2)), r))
    hubs = []
    for (prefix, domain), items in groups.items():
        nums = [n for n, _ in items]
        if len(items) >= 3 and max(nums) - min(nums) <= 100:
            members = [r for _, r in items]
            if not is_family(members):
                hubs.append(_hub("templatedEmail", f"email:{prefix}@{domain}", [m["beneficiary_id"] for m in members],
                                 f"{prefix}###@{domain}", "email"))
    return hubs


def address_hubs(rows):
    """Unrelated people (3+ different fathers) registered at one normalised address."""
    groups = defaultdict(list)
    for r in rows:
        groups[address_key(r)].append(r)
    hubs = []
    for key, members in groups.items():
        if 3 <= len(members) <= PUBLIC_HUB_SIZE and len({m["father_name"].lower() for m in members}) >= 3:
            label = f'{members[0]["address_line"]}, {members[0]["village_town"]}'
            hubs.append(_hub("sharedAddress", f"address:{key}", [m["beneficiary_id"] for m in members], label, "address"))
    return hubs


def identity_hubs(rows):
    """Near-duplicate identities: same DOB (block), similar name or phonetic first name, similar father,
    and NOT the same household (twins share address + exact father)."""
    by_dob = defaultdict(list)
    for r in rows:
        by_dob[r["dob"]].append(r)
    parent = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for block in by_dob.values():
        if len(block) < 2:
            continue
        for i in range(len(block)):
            a = block[i]
            a_first = a["full_name"].split()[0]
            for b in block[i + 1:]:
                if address_key(a) == address_key(b) and a["father_name"] == b["father_name"]:
                    continue  # twins / same household
                father = fuzz.ratio(a["father_name"].lower(), b["father_name"].lower())
                if father < FATHER_SIMILARITY:
                    continue
                name = fuzz.ratio(a["full_name"].lower(), b["full_name"].lower())
                phonetic = jellyfish.metaphone(a_first) == jellyfish.metaphone(b["full_name"].split()[0])
                if name >= NAME_SIMILARITY or phonetic or father >= 90:
                    parent[find(a["beneficiary_id"])] = find(b["beneficiary_id"])
    groups = defaultdict(list)
    for x in parent:
        groups[find(x)].append(x)
    return [_hub("sameDobFather", f"identity:{root}", members, "Same DOB + father", "identity")
            for root, members in groups.items() if len(members) >= 2]


def link_records(rows) -> list:
    """All hubs. Each hub: {signal, key, members: [recordId], label, kind, weight}."""
    return (exact_hubs(rows) + ip_hubs(rows) + batch_phone_hubs(rows) + email_template_hubs(rows)
            + address_hubs(rows) + identity_hubs(rows))
