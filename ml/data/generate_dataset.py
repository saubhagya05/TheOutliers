"""Generate the simulated scholarship ledger with planted ring ghosts and lone ghosts.

Usage (from repo root):
    python ml/data/generate_dataset.py                       # dev set: tune on this  -> ml/data/
    python ml/data/generate_dataset.py --profile test        # test set: report this  -> ml/data/test/
    python ml/data/generate_dataset.py --rows 200000 --out ml/data/scale   # throughput run

Writes to the output folder:
    ledger.csv         what the detector sees (no labels)
    transfers.csv      money movements after payout (for cycle / collector detection)
    truth.csv          ground truth per record; ONLY the benchmark script may read it
    planted.json       summary of what was planted
    dataset_info.json  GET /api/dataset payload for the Dataset & Method page

Bias controls (so the detector cannot win by memorising the generator):
- Legitimate look-alikes for every ghost signal: families (address, phone, account), twins (same DOB,
  father, address), CSC centres (shared IP), college fee accounts (legit fan-in of money), genuine
  people with a phone typo, an expired Aadhaar or many failed logins.
- Noisy rings: each signal is carried by only part of a ring, sequences have gaps, some members live elsewhere.
- Two ring types held out of tuning; the test profile shifts ring sizes, noise and rates.

Stdlib only. All identities are synthetic.
"""
import argparse
import csv
import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
WINDOW_START = datetime(2025, 7, 1, tzinfo=timezone.utc)
WINDOW_DAYS = 60
PAYOUT_START = datetime(2025, 9, 10, 9, tzinfo=timezone.utc)
SCHEME = "Post-Matric Scholarship 2025-26"

PROFILES = {
    # dev = tune here. test = shifted distribution, report final numbers here, run once.
    "dev": {"seed": 7, "ring_rate": 0.02, "lone_rate": 0.012, "ring_size": (5, 18), "participation": (0.6, 0.95),
            "lone_lookalike_rate": 0.008, "twin_rate": 0.05, "cross_district": 0.15},
    "test": {"seed": 11, "ring_rate": 0.025, "lone_rate": 0.01, "ring_size": (4, 25), "participation": (0.5, 0.85),
             "lone_lookalike_rate": 0.009, "twin_rate": 0.07, "cross_district": 0.25},
}

# ---------------------------------------------------------------- reference data

MALE = ["Rajesh", "Amit", "Suresh", "Rahul", "Vikas", "Manoj", "Sanjay", "Ravi", "Deepak", "Arjun", "Rohit", "Anil",
        "Mohammed", "Imran", "Sunil", "Pankaj", "Abhishek", "Nitin", "Gaurav", "Ajay", "Vivek", "Ankit", "Aman",
        "Saurabh", "Prakash", "Ramesh", "Dinesh", "Mukesh", "Aakash", "Shubham", "Faizan", "Arif", "Kunal", "Vishal",
        "Harsh", "Ritesh", "Santosh", "Alok", "Nikhil", "Sachin"]
FEMALE = ["Asha", "Sunita", "Priya", "Pooja", "Meena", "Anjali", "Neha", "Kavita", "Rekha", "Shabnam", "Nisha",
          "Rani", "Sapna", "Komal", "Divya", "Ritu", "Seema", "Kiran", "Jyoti", "Rubina", "Khushboo", "Sneha",
          "Shalini", "Preeti", "Aarti", "Nazia", "Puja", "Manisha", "Rinki", "Sangeeta", "Radha", "Sonam", "Tanya",
          "Payal", "Archana", "Shruti", "Farheen", "Swati", "Mamta", "Neelam"]
FATHER = ["Ram Prasad", "Shyam Lal", "Mohan", "Raj Kumar", "Ramesh", "Suresh", "Mahesh", "Dinesh", "Abdul Rashid",
          "Mohammad Iqbal", "Shiv Shankar", "Ganesh", "Bhola", "Ramesh Chandra", "Hari Narayan", "Om Prakash",
          "Jagdish", "Rajendra", "Nand Kishore", "Krishna", "Lal Babu", "Uday Shankar", "Anwar", "Satish"]
SURNAMES = ["Kumar", "Singh", "Yadav", "Prasad", "Sharma", "Paswan", "Mandal", "Gupta", "Khan", "Ansari", "Ram",
            "Mahto", "Thakur", "Jha", "Mishra", "Rai", "Chaudhary", "Sah", "Verma", "Pandey", "Tiwari", "Choudhary",
            "Meena", "Jatav", "Kushwaha", "Patel", "Maurya", "Nishad", "Saini", "Qureshi"]
FEMALE_ONLY_SURNAMES = ["Devi", "Kumari", "Khatoon"]
# Real twins often get rhyming or near-identical names: a legitimate source of "similar names, same DOB".
TWIN_NAMES = {"M": [("Luv", "Kush"), ("Ram", "Shyam"), ("Rahul", "Rohit"), ("Aman", "Chaman"), ("Hasan", "Husain"),
                    ("Vikas", "Vishal")],
              "F": [("Pooja", "Puja"), ("Riya", "Siya"), ("Neha", "Sneha"), ("Kavita", "Savita"), ("Gita", "Sita"),
                    ("Rani", "Rina")]}

# district, state, towns, pincode prefix, mobile-ISP IP prefixes
DISTRICTS = [
    ("Patna", "Bihar", ["Danapur", "Phulwari", "Bakhtiyarpur"], "800", ["49.36", "106.207"]),
    ("Nalanda", "Bihar", ["Rajgir", "Hilsa", "Islampur"], "803", ["49.37", "157.38"]),
    ("Gaya", "Bihar", ["Bodh Gaya", "Sherghati", "Tekari"], "823", ["106.210", "223.187"]),
    ("Muzaffarpur", "Bihar", ["Kanti", "Motipur", "Sakra"], "842", ["117.99", "49.38"]),
    ("Darbhanga", "Bihar", ["Benipur", "Biraul", "Jale"], "846", ["152.58", "106.211"]),
    ("Lucknow", "Uttar Pradesh", ["Malihabad", "Bakshi Ka Talab", "Mohanlalganj"], "226", ["106.215", "157.34"]),
    ("Varanasi", "Uttar Pradesh", ["Pindra", "Rajatalab", "Chiraigaon"], "221", ["223.190", "49.42"]),
    ("Gorakhpur", "Uttar Pradesh", ["Chauri Chaura", "Campierganj", "Sahjanwa"], "273", ["117.97", "106.216"]),
    ("Ranchi", "Jharkhand", ["Kanke", "Ratu", "Ormanjhi"], "834", ["152.59", "157.40"]),
    ("Dhanbad", "Jharkhand", ["Jharia", "Govindpur", "Baghmara"], "826", ["49.44", "223.191"]),
    ("Jaipur", "Rajasthan", ["Chomu", "Sanganer", "Bassi"], "302", ["106.219", "117.96"]),
    ("Indore", "Madhya Pradesh", ["Mhow", "Sanwer", "Depalpur"], "452", ["157.41", "49.46"]),
]
BANKS = [("SBI", "SBIN"), ("PNB", "PUNB"), ("Bank of Baroda", "BARB"), ("Canara", "CNRB"), ("Union Bank", "UBIN"),
         ("India Post Payments Bank", "IPOS"), ("HDFC", "HDFC"), ("ICICI", "ICIC"), ("Axis", "UTIB")]
BANK_WEIGHTS = [30, 14, 10, 8, 8, 12, 6, 6, 6]
UPI_HANDLES = ["ybl", "okaxis", "oksbi", "paytm", "ibl", "okhdfcbank", "upi"]
EMAIL_DOMAINS = ["gmail.com"] * 17 + ["yahoo.com", "rediffmail.com", "outlook.com"]
DISPOSABLE_DOMAINS = ["yopmail.com", "mail7.in", "tempinbox.in"]
AMOUNTS = [12000, 18000, 25000, 36000, 50000]
TRANSFER_CHANNELS = ["UPI", "IMPS", "NEFT"]

NAME_VARIANTS = {
    "Mohammed": ["Mohd", "Mohammad", "Md"], "Kumar": ["Kumaar", "Kr"], "Sharma": ["Sarma", "Sharmaa"],
    "Choudhary": ["Chaudhary", "Chaudhari"], "Pooja": ["Puja"], "Priya": ["Priyaa"], "Jyoti": ["Jyothi"],
    "Khushboo": ["Khushbu"], "Rahul": ["Rahool"], "Vikas": ["Vikash"], "Prasad": ["Prashad"], "Yadav": ["Yadava"],
    "Neha": ["Nehaa"], "Sunita": ["Sunitha"], "Deepak": ["Dipak"], "Shubham": ["Subham"], "Ankit": ["Ankeet"],
}

# ---------------------------------------------------------------- Aadhaar (Verhoeff checksum)

_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]
_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]


def verhoeff_digit(num: str) -> str:
    c = 0
    for i, d in enumerate(reversed(num)):
        c = _D[c][_P[(i + 1) % 8][int(d)]]
    return str(_INV[c])


def verhoeff_valid(num: str) -> bool:
    if len(num) != 12 or not num.isdigit() or num[0] in "01":
        return False
    c = 0
    for i, d in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(d)]]
    return c == 0


def phone_valid(p: str) -> bool:
    return len(p) == 10 and p.isdigit() and p[0] in "6789" and len(set(p)) > 1


# ---------------------------------------------------------------- generator


class Generator:
    RING_TYPES = {
        # type: (signals, held_out)
        "account_funnel": (["shared_account", "shared_ip_burst"], False),
        "upi_collector": (["shared_upi", "templated_email"], False),
        "biometric_clone": (["shared_biometric", "name_variant", "same_dob_father"], False),
        "ip_farm": (["shared_ip_burst", "batch_phone", "templated_email"], False),
        "phone_batch": (["batch_phone", "shared_account"], False),
        "address_cluster": (["shared_address", "shared_account", "name_variant"], False),
        "kickback_cycle": (["collector_transfer", "kickback_cycle", "batch_phone"], False),
        # Held out of tuning: only weak, partial signals.
        "slow_drip": (["shared_ip_slow", "shared_address"], True),
        "identity_reuse": (["name_variant", "same_dob_father", "batch_phone"], True),
    }
    LONE_TRAITS = ["invalid_aadhaar", "expired_aadhaar", "invalid_phone", "duplicate_phone", "login_bruteforce"]

    def __init__(self, rows: int, profile: dict, seed: int):
        self.rows = rows
        self.p = profile
        self.r = random.Random(seed)
        self.records = []  # {"row": ledger columns, "truth": labels}
        self.transfers = []
        self.used_aadhaar = set()
        self.used_phones = set()
        self.used_accounts = set()
        self.csc_ips = {d[0]: [self.mobile_ip(d) for _ in range(3)] for d in DISTRICTS}
        # Legit fan-in: colleges receive fees from many students. Hard negative for collector detection.
        self.college_accounts = {d[0]: [self.account()["bank_account_number"] for _ in range(2)] for d in DISTRICTS}
        self.merchant_accounts = [self.account()["bank_account_number"] for _ in range(300)]

    # ---- primitives

    def ts(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    def aadhaar(self) -> str:
        while True:
            base = str(self.r.randint(2, 9)) + "".join(str(self.r.randint(0, 9)) for _ in range(10))
            num = base + verhoeff_digit(base)
            if num not in self.used_aadhaar:
                self.used_aadhaar.add(num)
                return num

    def phone(self) -> str:
        while True:
            p = str(self.r.choice("6789")) + "".join(str(self.r.randint(0, 9)) for _ in range(9))
            if p not in self.used_phones:
                self.used_phones.add(p)
                return p

    def biometric(self) -> str:
        return hashlib.sha256(str(self.r.random()).encode()).hexdigest()[:24]

    def account(self):
        bank, code = self.r.choices(BANKS, weights=BANK_WEIGHTS)[0]
        while True:
            acc = "".join(str(self.r.randint(0, 9)) for _ in range(self.r.choice([11, 12, 14, 16])))
            if acc not in self.used_accounts:
                self.used_accounts.add(acc)
                break
        return {"bank_name": bank, "bank_account_number": acc, "ifsc": f"{code}0{self.r.randint(100000, 999999)}"}

    def mobile_ip(self, district) -> str:
        return f"{self.r.choice(district[4])}.{self.r.randint(0, 255)}.{self.r.randint(1, 254)}"

    def reg_time(self, odd_hour=False) -> datetime:
        day = self.r.randint(0, WINDOW_DAYS - 1)
        hour = self.r.randint(0, 5) if odd_hour else min(23, max(6, int(self.r.gauss(15, 3.5))))
        return WINDOW_START + timedelta(days=day, hours=hour, minutes=self.r.randint(0, 59), seconds=self.r.randint(0, 59))

    def address(self, district):
        town = self.r.choice(district[2])
        style = self.r.random()
        house = self.r.randint(1, 250)
        ward = self.r.randint(1, 30)
        if style < 0.5:
            line = f"House {house}, Ward {ward}"
        elif style < 0.8:
            line = f"H.No. {house}, Ward No. {ward}"
        else:
            line = f"{house}, Mohalla {self.r.choice(['Naya Tola', 'Purani Basti', 'Station Road', 'Bazar Para', 'Shiv Nagar'])}"
        return {"address_line": line, "village_town": town, "district": district[0], "state": district[1],
                "pincode": f"{district[3]}{self.r.randint(1, 199):03d}"}

    def email(self, first, last, p_empty=0.35):
        if self.r.random() < p_empty:
            return ""
        sep = self.r.choice([".", "", "_"])
        tail = self.r.choice(["", str(self.r.randint(1, 99)), str(self.r.randint(1995, 2009))])
        return f"{first.lower()}{sep}{last.lower()}{tail}@{self.r.choice(EMAIL_DOMAINS)}"

    def upi(self, first, phone):
        if self.r.random() < 0.45:
            return ""
        return f"{phone}@{self.r.choice(UPI_HANDLES)}" if self.r.random() < 0.6 else f"{first.lower()}{self.r.randint(10, 9999)}@{self.r.choice(UPI_HANDLES)}"

    def login(self):
        f = self.r.choices([0, 1, 2, 3, 4], weights=[70, 17, 8, 3, 2])[0]
        return {"login_attempts_failed": f, "login_success": True,
                "login_window_minutes": self.r.randint(1, 4) + f * self.r.randint(1, 6)}

    def transfer(self, src, dst, amount, when, channel=None):
        self.transfers.append({"from_account": src, "to_account": dst, "amount_inr": int(amount),
                               "ts": self.ts(when), "channel": channel or self.r.choice(TRANSFER_CHANNELS)})

    def carriers(self, members, minimum=3):
        """Each ring signal is carried by only part of the ring (noise), but always by at least `minimum`."""
        p = self.r.uniform(*self.p["participation"])
        chosen = [m for m in members if self.r.random() < p]
        if len(chosen) < minimum:
            chosen = self.r.sample(members, min(minimum, len(members)))
        return chosen

    @staticmethod
    def tag(rec, tag):
        rec["truth"]["hard_negative"] = ",".join(filter(None, [rec["truth"]["hard_negative"], tag]))

    # ---- people

    def person(self, district=None, surname=None, father=None, gender=None, household_id=None, allow_csc=True):
        district = district or self.r.choice(DISTRICTS)
        gender = gender or self.r.choice("MF")
        first = self.r.choice(MALE if gender == "M" else FEMALE)
        if surname is None:
            surname = self.r.choice(SURNAMES + (FEMALE_ONLY_SURNAMES if gender == "F" else []))
        father = father or f"{self.r.choice(FATHER)} {surname if surname not in FEMALE_ONLY_SURNAMES else self.r.choice(SURNAMES)}"
        age = self.r.choices(range(16, 31), weights=[4, 9, 12, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 2, 1])[0]
        dob = (WINDOW_START - timedelta(days=age * 365 + self.r.randint(0, 364))).date()
        spouse = ""
        if age >= 21 and self.r.random() < 0.18:
            spouse = f"{self.r.choice(FEMALE if gender == 'M' else MALE)} {self.r.choice(SURNAMES)}"
        phone = self.phone()
        reg = self.reg_time()
        use_csc = allow_csc and self.r.random() < 0.3
        row = {
            "full_name": f"{first} {surname}", "father_name": father, "spouse_name": spouse, "gender": gender,
            "dob": dob.isoformat(), "age": age,
            "aadhaar_number": self.aadhaar(), "aadhaar_status": "active", "biometric_hash": self.biometric(),
            "phone": phone, "email": self.email(first, surname),
            **self.address(district),
            "registration_ip": self.r.choice(self.csc_ips[district[0]]) if use_csc else self.mobile_ip(district),
            "registration_channel": "CSC" if use_csc else "self",
            "registration_ts": self.ts(reg),
            "application_ts": self.ts(reg + timedelta(minutes=self.r.randint(4, 180))),
            **self.account(),
            "upi_id": self.upi(first, phone),
            "amount_inr": self.r.choice(AMOUNTS),
            "payout_ts": self.ts(PAYOUT_START + timedelta(days=self.r.randint(0, 14))),
            **self.login(),
        }
        row["payout_mode"] = "UPI" if row["upi_id"] and self.r.random() < 0.5 else "DBT_BANK"
        truth = {"label": "normal", "ring_id": "", "ring_type": "", "ghost_traits": "", "hard_negative": "",
                 "held_out": False, "household_id": household_id or ""}
        if use_csc:
            truth["hard_negative"] = "csc_shared_ip"
        return {"row": row, "truth": truth, "_first": first, "_surname": surname, "_district": district}

    def add(self, rec):
        self.records.append(rec)
        return rec

    # ---- base population with households (legitimate sharing)

    def population(self, n):
        hh = 0
        while n > 0:
            hh += 1
            size = min(n, self.r.choices([1, 2, 3, 4], weights=[72, 20, 6, 2])[0])
            district = self.r.choice(DISTRICTS)
            surname = self.r.choice(SURNAMES)
            father = f"{self.r.choice(FATHER)} {surname}"
            members = [self.person(district, surname, father, household_id=f"H{hh:06d}") for _ in range(size)]
            if size > 1:
                head = members[0]["row"]
                share_phone = self.r.random() < 0.35
                share_account = self.r.random() < 0.12
                for m in members[1:]:
                    row = m["row"]
                    for k in ("address_line", "village_town", "district", "state", "pincode"):
                        row[k] = head[k]
                    self.tag(m, "family_shared_address")
                    if share_phone:
                        row["phone"] = head["phone"]
                        self.tag(m, "family_shared_phone")
                    if share_account:
                        for k in ("bank_name", "bank_account_number", "ifsc"):
                            row[k] = head[k]
                        self.tag(m, "family_shared_account")
                    elif self.r.random() < 0.15:  # sibling sends money home
                        self.transfer(row["bank_account_number"], head["bank_account_number"],
                                      row["amount_inr"] * self.r.uniform(0.1, 0.4),
                                      PAYOUT_START + timedelta(days=self.r.randint(1, 30)))
                if self.r.random() < self.p["twin_rate"]:
                    a, b = members[0], members[1]
                    b["row"]["gender"] = a["row"]["gender"]
                    pair = self.r.choice(TWIN_NAMES[a["row"]["gender"]])
                    a["row"]["full_name"] = f"{pair[0]} {surname}"
                    b["row"]["full_name"] = f"{pair[1]} {surname}"
                    b["row"]["dob"], b["row"]["age"] = a["row"]["dob"], a["row"]["age"]
                    for m in (a, b):
                        self.tag(m, "twins")
            for m in members:
                self.add(m)
            n -= size

    def normal_money(self, normals):
        """Legit post-payout money: college fees (fan-in to a few accounts) and shop/peer payments.
        Shop payments go to everyone, ghosts included, so "has any transfer" reveals nothing."""
        for rec in normals:
            row = rec["row"]
            if self.r.random() < 0.25:
                self.transfer(row["bank_account_number"], self.r.choice(self.college_accounts[row["district"]]),
                              row["amount_inr"] * self.r.uniform(0.4, 0.8),
                              PAYOUT_START + timedelta(days=self.r.randint(1, 30), hours=self.r.randint(9, 17)), "NEFT")
                self.tag(rec, "paid_college_fees")
        for rec in self.records:
            row = rec["row"]
            paid = PAYOUT_START + timedelta(days=self.r.randint(0, 14))
            for _ in range(self.r.choice([0, 0, 0, 1, 2])):
                self.transfer(row["bank_account_number"], self.r.choice(self.merchant_accounts),
                              self.r.randint(200, 4000), paid + timedelta(days=self.r.randint(1, 40), hours=self.r.randint(8, 22)), "UPI")

    # ---- ring ghosts

    def variant(self, name: str) -> str:
        parts = name.split()
        for i, part in enumerate(parts):
            if part in NAME_VARIANTS and self.r.random() < 0.8:
                parts[i] = self.r.choice(NAME_VARIANTS[part])
                return " ".join(parts)
        word = parts[0]
        j = self.r.randint(1, len(word) - 1)
        parts[0] = word[:j] + word[j - 1] + word[j:] if self.r.random() < 0.5 else word[:j] + word[j + 1:]
        return " ".join(parts)

    def plant_ring(self, ring_id, ring_type):
        signals, held_out = self.RING_TYPES[ring_type]
        size = self.r.randint(*self.p["ring_size"])
        district = self.r.choice(DISTRICTS)
        members = [self.person(district if self.r.random() >= self.p["cross_district"] else None) for _ in range(size)]
        rows = [m["row"] for m in members]
        base = rows[0]

        if "shared_account" in signals:
            accounts = [self.account() for _ in range(self.r.choice([1, 1, 2]))]
            for i, m in enumerate(self.carriers(members)):
                m["row"].update(accounts[i % len(accounts)])
        if "shared_upi" in signals:
            collector = f"{self.r.choice(['cash', 'pay', 'help', 'seva'])}{self.r.randint(100, 999)}@{self.r.choice(UPI_HANDLES)}"
            for m in self.carriers(members):
                m["row"]["upi_id"] = collector
                m["row"]["payout_mode"] = "UPI"
        if "shared_biometric" in signals:
            bio = [self.biometric() for _ in range(self.r.choice([1, 2]))]
            for i, m in enumerate(self.carriers(members)):
                m["row"]["biometric_hash"] = bio[i % len(bio)]
        if "shared_ip_burst" in signals or "shared_ip_slow" in signals:
            ip = self.mobile_ip(district)
            start = self.reg_time()
            spread = 45 if "shared_ip_burst" in signals else 60 * 24 * 6  # 45 minutes vs ~6 days
            for m in self.carriers(members):
                reg = start + timedelta(minutes=self.r.randint(0, spread))
                m["row"].update(registration_ip=ip, registration_channel="self", registration_ts=self.ts(reg),
                                application_ts=self.ts(reg + timedelta(minutes=self.r.randint(2, 25))))
        if "batch_phone" in signals:
            n = int(self.phone()[:9] + "0")
            for m in self.carriers(members):
                n += self.r.randint(1, 7)  # gaps, not a perfect sequence
                m["row"]["phone"] = str(n)
                self.used_phones.add(str(n))
        if "templated_email" in signals:
            prefix = self.r.choice(["user", "stu", "sch", "app", "acc"])
            num = self.r.randint(100, 900)
            domain = self.r.choice(DISPOSABLE_DOMAINS)
            for m in self.carriers(members):
                num += self.r.randint(1, 4)
                m["row"]["email"] = f"{prefix}{num}@{domain}"
        if "shared_address" in signals:
            addr = {k: base[k] for k in ("address_line", "village_town", "district", "state", "pincode")}
            for m in self.carriers(members):
                m["row"].update(addr)
                if self.r.random() < 0.4:  # format variants: exact matching misses them, fuzzy matching is needed
                    m["row"]["address_line"] = addr["address_line"].replace("House", "H.No.").replace("Ward", "Wd")
        if "name_variant" in signals:
            for m in self.carriers(members)[1:]:
                m["row"]["full_name"] = self.variant(base["full_name"])
        if "same_dob_father" in signals:
            for m in self.carriers(members):
                m["row"]["dob"], m["row"]["age"] = base["dob"], base["age"]
                m["row"]["father_name"] = base["father_name"] if self.r.random() < 0.6 else self.variant(base["father_name"])
        if "collector_transfer" in signals:
            collector = self.account()["bank_account_number"]
            agents = [self.account()["bank_account_number"] for _ in range(self.r.randint(2, 3))]
            forwarded = 0
            carriers = self.carriers(members)
            for m in carriers:
                row = m["row"]
                when = datetime.strptime(row["payout_ts"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                amount = row["amount_inr"] * self.r.uniform(0.6, 0.9)
                forwarded += amount
                self.transfer(row["bank_account_number"], collector, amount, when + timedelta(minutes=self.r.randint(5, 180)))
            last = PAYOUT_START + timedelta(days=16)
            for a in agents:  # collector splits the money to agents
                self.transfer(collector, a, forwarded / len(agents) * self.r.uniform(0.8, 0.95), last + timedelta(hours=self.r.randint(1, 30)))
            if "kickback_cycle" in signals:  # agents pay a small "commission" back to members: closes the cycle
                for m in self.r.sample(carriers, min(len(carriers), self.r.randint(2, 4))):
                    self.transfer(self.r.choice(agents), m["row"]["bank_account_number"], self.r.randint(1000, 3000),
                                  last + timedelta(days=self.r.randint(2, 6)))

        for m in members:
            m["truth"].update(label="ring", ring_id=ring_id, ring_type=ring_type, ghost_traits=",".join(signals),
                              hard_negative="", held_out=held_out, household_id="")
            self.add(m)
        return {"ringId": ring_id, "type": ring_type, "size": size, "signals": signals, "heldOut": held_out,
                "district": district[0]}

    # ---- lone ghosts and their legitimate look-alikes

    def plant_lone(self, normals):
        m = self.person(allow_csc=False)
        row = m["row"]
        # Weak correlates (not decisive alone): ghosts register at odd hours and skip email more often.
        if self.r.random() < 0.55:
            reg = self.reg_time(odd_hour=True)
            row["registration_ts"] = self.ts(reg)
            row["application_ts"] = self.ts(reg + timedelta(minutes=self.r.randint(2, 30)))
        if self.r.random() < 0.6:
            row["email"] = ""
        traits = self.r.sample(self.LONE_TRAITS, 1 if self.r.random() < 0.6 else 2)
        if "invalid_phone" in traits and "duplicate_phone" in traits:  # would overwrite each other
            traits.remove("duplicate_phone")
        for t in traits:
            if t == "invalid_aadhaar":
                a = row["aadhaar_number"]
                if self.r.random() < 0.8:
                    row["aadhaar_number"] = a[:-1] + str((int(a[-1]) + self.r.randint(1, 9)) % 10)
                else:
                    row["aadhaar_number"] = self.r.choice([a[:11], "1" + a[1:], "0" + a[1:]])
            elif t == "expired_aadhaar":
                row["aadhaar_status"] = self.r.choice(["expired", "deactivated"])
            elif t == "invalid_phone":
                p = row["phone"]
                row["phone"] = self.r.choice([p[:9], str(self.r.randint(0, 5)) + p[1:], p + str(self.r.randint(0, 9)), "0000000000"])
            elif t == "duplicate_phone":
                row["phone"] = self.r.choice(normals)["row"]["phone"]
            elif t == "login_bruteforce":
                row["login_attempts_failed"] = self.r.randint(6, 30)
                row["login_success"] = True
                row["login_window_minutes"] = self.r.randint(2, 20)
        m["truth"].update(label="lone", ghost_traits=",".join(traits), hard_negative="")
        self.add(m)
        return traits

    def lone_lookalikes(self, normals):
        """Genuine people with one lone-ghost-like signal, so no single rule separates ghosts perfectly."""
        k = int(len(normals) * self.p["lone_lookalike_rate"])
        for rec in self.r.sample(normals, k):
            row = rec["row"]
            kind = self.r.choice(["phone_typo", "aadhaar_typo", "aadhaar_pending_update", "forgetful_login"])
            if kind == "phone_typo":  # data-entry operator error, usually at a CSC
                p = row["phone"]
                row["phone"] = p[:9] if self.r.random() < 0.5 else p[:4] + p[5] + p[4] + p[6:]
                if not phone_valid(row["phone"]):
                    row["phone"] = p[:9]
            elif kind == "aadhaar_typo":  # one digit mistyped at data entry breaks the checksum
                a = row["aadhaar_number"]
                j = self.r.randint(1, 10)
                row["aadhaar_number"] = a[:j] + str((int(a[j]) + self.r.randint(1, 9)) % 10) + a[j + 1:]
            elif kind == "aadhaar_pending_update":
                row["aadhaar_status"] = "expired"
            else:
                row["login_attempts_failed"] = self.r.randint(5, 10)
                row["login_window_minutes"] = self.r.randint(5, 45)
            self.tag(rec, kind)

    # ---- build

    def build(self):
        rings, ring_records, i = [], 0, 0
        types = list(self.RING_TYPES)
        while ring_records < int(self.rows * self.p["ring_rate"]):
            info = self.plant_ring(f"RING-{i + 1:03d}", types[i % len(types)])
            rings.append(info)
            ring_records += info["size"]
            i += 1

        n_lone = int(self.rows * self.p["lone_rate"])
        self.population(self.rows - ring_records - n_lone)
        normals = [rec for rec in self.records if rec["truth"]["label"] == "normal"]
        self.lone_lookalikes(normals)

        lone_traits = {}
        for _ in range(n_lone):
            for t in self.plant_lone(normals):
                lone_traits[t] = lone_traits.get(t, 0) + 1
        self.normal_money(normals)

        # Shuffle, then assign IDs so neither order nor ID reveals a ring.
        self.r.shuffle(self.records)
        for idx, rec in enumerate(self.records, start=1):
            rec["row"] = {"beneficiary_id": f"B-{idx:06d}", "application_id": f"APP{self.r.randint(10 ** 9, 10 ** 10 - 1)}",
                          "scheme": SCHEME, **rec["row"]}
            rec["truth"] = {"beneficiary_id": rec["row"]["beneficiary_id"], **rec["truth"]}
        self.transfers.sort(key=lambda t: t["ts"])
        for idx, t in enumerate(self.transfers, start=1):
            t["transfer_id"] = f"T-{idx:07d}"
        return rings, lone_traits


# ---------------------------------------------------------------- outputs

LEDGER_COLUMNS = [
    "beneficiary_id", "application_id", "scheme",
    "full_name", "father_name", "spouse_name", "gender", "dob", "age",
    "aadhaar_number", "aadhaar_status", "biometric_hash",
    "phone", "email",
    "address_line", "village_town", "district", "state", "pincode",
    "registration_ip", "registration_channel", "registration_ts", "application_ts",
    "bank_name", "bank_account_number", "ifsc", "upi_id", "payout_mode", "amount_inr", "payout_ts",
    "login_attempts_failed", "login_success", "login_window_minutes",
]
TRANSFER_COLUMNS = ["transfer_id", "from_account", "to_account", "amount_inr", "ts", "channel"]
TRUTH_COLUMNS = ["beneficiary_id", "label", "ring_id", "ring_type", "ghost_traits", "hard_negative", "held_out", "household_id"]

COLUMN_DOCS = [
    ("Identity", [
        ("full_name, father_name, spouse_name", ["ring"], "Levenshtein + phonetic matching for name variants of one identity"),
        ("dob, age, gender", ["ring"], "Same DOB + same father across 'different' people (twins are legitimate)"),
        ("aadhaar_number", ["ring", "lone"], "Duplicates (ring); Verhoeff checksum / format validity (lone)"),
        ("aadhaar_status", ["lone"], "Expired or deactivated Aadhaar still receiving money"),
        ("biometric_hash", ["ring"], "Same biometric enrolled under different names"),
    ]),
    ("Contact", [
        ("phone", ["ring", "lone"], "Shared or batch-sequential numbers (ring); malformed or duplicated (lone)"),
        ("email", ["ring"], "Templated addresses on disposable domains"),
        ("address_line, village_town, district, state, pincode", ["ring"], "Unrelated people at one address, with format variants"),
    ]),
    ("Registration", [
        ("registration_ip, registration_channel", ["ring"], "Many registrations from one IP in a short burst (CSC centres are legitimate)"),
        ("registration_ts, application_ts", ["ring", "lone"], "Burst timing (ring); odd-hour registration (weak lone signal)"),
        ("login_attempts_failed, login_success, login_window_minutes", ["lone"], "Many failed logins quickly, then success"),
    ]),
    ("Payment", [
        ("bank_name, bank_account_number, ifsc", ["ring"], "Many identities paying out to one account"),
        ("upi_id, payout_mode", ["ring"], "One collector UPI ID for many beneficiaries"),
        ("amount_inr, payout_ts", ["ring", "lone"], "Money at risk"),
    ]),
    ("Money movement (transfers.csv)", [
        ("from_account, to_account, amount_inr, ts, channel", ["ring"],
         "Fan-in to collector accounts and cyclic kickbacks (college fee accounts are legitimate fan-in)"),
    ]),
]
TYPE_DESC = {
    "account_funnel": "Unrelated identities paying out to 1-2 bank accounts, registered in a burst from one IP",
    "upi_collector": "Payouts routed to one collector UPI ID; templated disposable emails",
    "biometric_clone": "Same biometric under different names and Aadhaar numbers; same DOB and father",
    "ip_farm": "Burst of registrations from one IP with batch phones and templated emails",
    "phone_batch": "Batch phone numbers paying into a shared account",
    "address_cluster": "Unrelated surnames at one address (with spelling variants) sharing an account",
    "kickback_cycle": "Members forward 60-90% of payouts to a collector; agents pay commissions back (money cycles)",
    "slow_drip": "Held out: same IP spread over days plus a shared address (weak signals only)",
    "identity_reuse": "Held out: name variants with the same DOB/father and batch phones, no shared money trail",
}
HARD_DESC = {
    "csc_shared_ip": "Genuine applicants registering at a CSC centre (shared IP)",
    "family_shared_address": "Family members at one address",
    "family_shared_phone": "Siblings using a parent's phone",
    "family_shared_account": "Siblings paid into a parent's account",
    "twins": "Twins: same DOB, father and address, often rhyming names",
    "paid_college_fees": "Students paying fees to a college account (legitimate fan-in of money)",
    "phone_typo": "Genuine applicant with a mistyped phone number",
    "aadhaar_typo": "Genuine applicant whose Aadhaar was mistyped at data entry (checksum fails)",
    "aadhaar_pending_update": "Genuine applicant whose Aadhaar is expired pending update",
    "forgetful_login": "Genuine user with many failed logins over a longer window",
}


def write_csv(path, columns, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", choices=list(PROFILES), default="dev")
    ap.add_argument("--rows", type=int, default=20000)
    ap.add_argument("--seed", type=int, help="defaults to the profile's seed")
    ap.add_argument("--out", help="output folder (default: ml/data for dev, ml/data/test for test)")
    args = ap.parse_args()

    profile = PROFILES[args.profile]
    seed = args.seed if args.seed is not None else profile["seed"]
    out = Path(args.out) if args.out else (HERE if args.profile == "dev" else HERE / args.profile)
    out.mkdir(parents=True, exist_ok=True)

    g = Generator(args.rows, profile, seed)
    rings, lone_traits = g.build()
    records = g.records

    write_csv(out / "ledger.csv", LEDGER_COLUMNS, [r["row"] for r in records])
    write_csv(out / "transfers.csv", TRANSFER_COLUMNS, g.transfers)
    write_csv(out / "truth.csv", TRUTH_COLUMNS, [r["truth"] for r in records])

    ring_types = {}
    for ring in rings:
        t = ring_types.setdefault(ring["type"], {"type": ring["type"], "count": 0, "members": 0,
                                                  "signals": ring["signals"], "heldOut": ring["heldOut"]})
        t["count"] += 1
        t["members"] += ring["size"]
    hard, labels = {}, {}
    for r in records:
        labels[r["truth"]["label"]] = labels.get(r["truth"]["label"], 0) + 1
        for tag in filter(None, r["truth"]["hard_negative"].split(",")):
            hard[tag] = hard.get(tag, 0) + 1

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    planted = {
        "profile": args.profile, "rows": len(records), "seed": seed, "generatedAt": generated_at, "labels": labels,
        "transfers": len(g.transfers), "rings": len(rings), "ringTypes": list(ring_types.values()), "ringList": rings,
        "loneGhosts": labels.get("lone", 0), "loneTraits": lone_traits, "hardNegatives": hard,
    }
    (out / "planted.json").write_text(json.dumps(planted, indent=2), encoding="utf-8")

    dataset_info = {
        "name": f"{SCHEME} (simulated)",
        "simulated": True,
        "recordCount": len(records),
        "transferCount": len(g.transfers),
        "generatedAt": generated_at,
        "description": "Synthetic scholarship disbursement ledger plus post-payout money transfers. Names, addresses, phones, "
                       "Aadhaar numbers (valid Verhoeff checksums) and bank details follow realistic Indian formats. Families, "
                       "twins, CSC centres and college fee accounts create legitimate sharing. Ring and lone ghosts were planted "
                       "afterwards with labels kept in a separate file the detector never reads.",
        "columnGroups": [{"group": name, "columns": [{"name": n, "usedFor": u, "description": d} for n, u, d in cols]}
                         for name, cols in COLUMN_DOCS],
        "planted": {
            "rings": len(rings),
            "ringTypes": [{"type": t["type"], "count": t["count"], "heldOut": t["heldOut"], "description": TYPE_DESC[t["type"]]}
                          for t in ring_types.values()],
            "loneGhosts": labels.get("lone", 0),
            "loneTraits": lone_traits,
            "hardNegatives": [{"type": k, "count": v, "description": HARD_DESC.get(k, k)} for k, v in sorted(hard.items(), key=lambda kv: -kv[1])],
        },
        "howCreated": [
            "Generated households of students with realistic names, DOBs, addresses, phones, Aadhaar numbers and bank accounts.",
            "Added legitimate look-alikes for every ghost signal: families, twins, CSC centres, college fee accounts, phone typos, "
            "expired-but-genuine Aadhaar, forgetful logins.",
            f"Planted {len(rings)} rings across {len(ring_types)} types and {labels.get('lone', 0)} lone ghosts with 5 trait types. "
            "Each ring signal is carried by only part of the ring, with gaps and cross-district members.",
            "Held two ring types (slow_drip, identity_reuse) out of tuning; a separate test set with a different seed and "
            "shifted sizes, noise and rates is used once for the reported numbers.",
            "Shuffled records and assigned IDs afterwards so order and IDs reveal nothing.",
        ],
        "pipeline": [
            {"step": "Blocking", "description": "Group records by pincode, phone prefix and name initials to avoid comparing every pair."},
            {"step": "Record linkage", "description": "Levenshtein + phonetic names; exact match on account, UPI, biometric, phone, IP, email template."},
            {"step": "Entity graph", "description": "Records, accounts, UPI IDs, phones, IPs and addresses become nodes; shared attributes and transfers become edges."},
            {"step": "Ring discovery", "description": "Louvain community detection, cycle detection on transfers, fan-in to collectors, IP burst windows."},
            {"step": "Lone scoring", "description": "Aadhaar checksum and status, phone validity and duplication, login behaviour, combined."},
            {"step": "Explain", "description": "Top contributing signals become reasons, red table cells and an explainable risk index."},
        ],
        "limitations": [
            "Real welfare fraud labels are not public, so the ledger is simulated.",
            "Results are on simulated fraud plus component benchmarks, not on real welfare data.",
        ],
    }
    (out / "dataset_info.json").write_text(json.dumps(dataset_info, indent=2), encoding="utf-8")

    print(f"[{args.profile}] rows={len(records)} transfers={len(g.transfers)} labels={labels} -> {out}")
    print(f"rings={len(rings)} types={ {k: v['count'] for k, v in ring_types.items()} }")
    print(f"lone traits={lone_traits}")
    print(f"hard negatives={hard}")


if __name__ == "__main__":
    main()
