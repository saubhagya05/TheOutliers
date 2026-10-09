"""Generate the simulated scholarship ledger with planted ring ghosts and lone ghosts.

Usage (from repo root):
    python ml/data/generate_dataset.py                 # 20,000 rows, seed 7
    python ml/data/generate_dataset.py --rows 50000 --seed 11

Writes to ml/data/:
    ledger.csv         what the detector sees (no labels)
    truth.csv          ground truth per record; ONLY the benchmark script may read it
    planted.json       summary of what was planted
    dataset_info.json  GET /api/dataset payload for the Dataset & Method page

Stdlib only, so it runs anywhere. All identities are synthetic.
"""
import argparse
import csv
import hashlib
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
WINDOW_START = datetime(2025, 7, 1, tzinfo=timezone.utc)
WINDOW_DAYS = 60
PAYOUT_START = datetime(2025, 9, 10, 9, tzinfo=timezone.utc)
SCHEME = "Post-Matric Scholarship 2025-26"

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

# Transliteration and typo variants used to build "same person, slightly different name" records.
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
    if len(num) != 12 or not num.isdigit():
        return False
    c = 0
    for i, d in enumerate(reversed(num)):
        c = _D[c][_P[i % 8][int(d)]]
    return c == 0


# ---------------------------------------------------------------- generator


class Generator:
    def __init__(self, rows: int, seed: int):
        self.rows = rows
        self.r = random.Random(seed)
        self.seed = seed
        self.records = []  # each: {"row": {...ledger columns}, "truth": {...}}
        self.used_aadhaar = set()
        self.used_phones = set()
        self.used_accounts = set()
        self.csc_ips = {d[0]: [self.mobile_ip(d) for _ in range(3)] for d in DISTRICTS}

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

    def reg_time(self) -> datetime:
        day = self.r.randint(0, WINDOW_DAYS - 1)
        hour = min(23, max(6, int(self.r.gauss(15, 3.5))))
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

    def email(self, first, last):
        if self.r.random() < 0.35:
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
        acc = self.account()
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
            **acc,
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
        return {"row": row, "truth": truth, "_first": first, "_surname": surname}

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
                    tags = ["family_shared_address"]
                    if share_phone:
                        row["phone"] = head["phone"]
                        tags.append("family_shared_phone")
                    if share_account:
                        for k in ("bank_name", "bank_account_number", "ifsc"):
                            row[k] = head[k]
                        tags.append("family_shared_account")
                    m["truth"]["hard_negative"] = ",".join(filter(None, [m["truth"]["hard_negative"], *tags]))
            for m in members:
                self.add(m)
            n -= size

    # ---- ring ghosts

    RING_TYPES = {
        # type: (signals, held_out)
        "account_funnel": (["shared_account", "shared_ip_burst"], False),
        "upi_collector": (["shared_upi", "templated_email"], False),
        "biometric_clone": (["shared_biometric", "name_variant", "same_dob_father"], False),
        "ip_farm": (["shared_ip_burst", "batch_phone", "templated_email"], False),
        "phone_batch": (["batch_phone", "shared_account"], False),
        "address_cluster": (["shared_address", "shared_account", "name_variant"], False),
        # Held out of tuning: only weak, partial signals.
        "slow_drip": (["shared_ip_slow", "shared_address"], True),
        "identity_reuse": (["name_variant", "same_dob_father", "batch_phone"], True),
    }

    def variant(self, name: str) -> str:
        parts = name.split()
        for i, p in enumerate(parts):
            if p in NAME_VARIANTS and self.r.random() < 0.8:
                parts[i] = self.r.choice(NAME_VARIANTS[p])
                return " ".join(parts)
        # fallback: small typo (double or drop a letter)
        p = parts[0]
        j = self.r.randint(1, len(p) - 1)
        parts[0] = p[:j] + p[j - 1] + p[j:] if self.r.random() < 0.5 else p[:j] + p[j + 1:]
        return " ".join(parts)

    def plant_ring(self, ring_id, ring_type):
        signals, held_out = self.RING_TYPES[ring_type]
        size = self.r.randint(5, 18)
        district = self.r.choice(DISTRICTS)
        members = [self.person(district if self.r.random() < 0.85 else None) for _ in range(size)]
        rows = [m["row"] for m in members]
        base = rows[0]

        if "shared_account" in signals:
            accounts = [self.account() for _ in range(self.r.choice([1, 1, 2]))]
            for i, row in enumerate(rows):
                row.update(accounts[i % len(accounts)])
        if "shared_upi" in signals:
            collector = f"{self.r.choice(['cash', 'pay', 'help', 'seva'])}{self.r.randint(100, 999)}@{self.r.choice(UPI_HANDLES)}"
            for row in rows:
                row["upi_id"] = collector
                row["payout_mode"] = "UPI"
        if "shared_biometric" in signals:
            bio = [self.biometric() for _ in range(self.r.choice([1, 2]))]
            for i, row in enumerate(rows):
                row["biometric_hash"] = bio[i % len(bio)]
        if "shared_ip_burst" in signals or "shared_ip_slow" in signals:
            ip = self.mobile_ip(district)
            start = self.reg_time()
            spread = 45 if "shared_ip_burst" in signals else 60 * 24 * 6  # 45 minutes vs ~6 days
            for row in rows:
                reg = start + timedelta(minutes=self.r.randint(0, spread))
                row["registration_ip"] = ip
                row["registration_channel"] = "self"
                row["registration_ts"] = self.ts(reg)
                row["application_ts"] = self.ts(reg + timedelta(minutes=self.r.randint(2, 25)))
        if "batch_phone" in signals:
            start = int(self.phone()[:9] + "0")  # room for the sequence to stay 10 digits
            for i, row in enumerate(rows):
                row["phone"] = str(start + i * self.r.choice([1, 1, 2]))
                self.used_phones.add(row["phone"])
        if "templated_email" in signals:
            prefix = self.r.choice(["user", "stu", "sch", "app", "acc"])
            num = self.r.randint(100, 900)
            domain = self.r.choice(DISPOSABLE_DOMAINS)
            for i, row in enumerate(rows):
                row["email"] = f"{prefix}{num + i}@{domain}"
        if "shared_address" in signals:
            addr = {k: base[k] for k in ("address_line", "village_town", "district", "state", "pincode")}
            for row in rows:
                row.update(addr)
                # format variants so exact matching misses them and fuzzy matching is needed
                if self.r.random() < 0.4:
                    row["address_line"] = addr["address_line"].replace("House", "H.No.").replace("Ward", "Wd")
        if "name_variant" in signals:
            for row in rows[1:]:
                if self.r.random() < 0.6:
                    row["full_name"] = self.variant(base["full_name"])
        if "same_dob_father" in signals:
            for row in rows[1:]:
                if self.r.random() < 0.7:
                    row["dob"] = base["dob"]
                    row["age"] = base["age"]
                    row["father_name"] = base["father_name"] if self.r.random() < 0.6 else self.variant(base["father_name"])

        for m in members:
            m["truth"].update(label="ring", ring_id=ring_id, ring_type=ring_type, ghost_traits=",".join(signals),
                              hard_negative="", held_out=held_out, household_id="")
            self.add(m)
        return {"ringId": ring_id, "type": ring_type, "size": size, "signals": signals, "heldOut": held_out,
                "district": district[0]}

    # ---- lone ghosts

    LONE_TRAITS = ["invalid_aadhaar", "expired_aadhaar", "invalid_phone", "duplicate_phone", "login_bruteforce"]

    def plant_lone(self, normals):
        m = self.person(allow_csc=False)
        row = m["row"]
        k = 1 if self.r.random() < 0.6 else 2
        traits = self.r.sample(self.LONE_TRAITS, k)
        if "invalid_phone" in traits and "duplicate_phone" in traits:  # would overwrite each other
            traits.remove("duplicate_phone")
        for t in traits:
            if t == "invalid_aadhaar":
                a = row["aadhaar_number"]
                if self.r.random() < 0.8:  # wrong checksum digit
                    bad = str((int(a[-1]) + self.r.randint(1, 9)) % 10)
                    row["aadhaar_number"] = a[:-1] + bad
                else:  # wrong length or starts with 0/1
                    row["aadhaar_number"] = self.r.choice([a[:11], "1" + a[1:], "0" + a[1:]])
            elif t == "expired_aadhaar":
                row["aadhaar_status"] = self.r.choice(["expired", "deactivated"])
            elif t == "invalid_phone":
                p = row["phone"]
                row["phone"] = self.r.choice([p[:9], str(self.r.randint(0, 5)) + p[1:], p + str(self.r.randint(0, 9)), "0000000000"])
            elif t == "duplicate_phone":
                other = self.r.choice(normals)["row"]
                row["phone"] = other["phone"]
            elif t == "login_bruteforce":
                f = self.r.randint(8, 30)
                row["login_attempts_failed"] = f
                row["login_success"] = True
                row["login_window_minutes"] = self.r.randint(2, 20)
        m["truth"].update(label="lone", ghost_traits=",".join(traits), hard_negative="")
        self.add(m)
        return traits

    # ---- build

    def build(self):
        n_ring_records_target = int(self.rows * 0.02)
        n_lone = int(self.rows * 0.012)

        rings = []
        types = list(self.RING_TYPES)
        ring_records = 0
        i = 0
        while ring_records < n_ring_records_target:
            ring_type = types[i % len(types)]
            info = self.plant_ring(f"RING-{i + 1:03d}", ring_type)
            rings.append(info)
            ring_records += info["size"]
            i += 1

        normal_count = self.rows - ring_records - n_lone
        self.population(normal_count)
        normals = [rec for rec in self.records if rec["truth"]["label"] == "normal"]

        # a few honest people who mistype their password a lot (hard negative for login_bruteforce)
        for rec in self.r.sample(normals, max(1, normal_count // 400)):
            rec["row"]["login_attempts_failed"] = self.r.randint(5, 7)
            rec["row"]["login_window_minutes"] = self.r.randint(10, 60)
            rec["truth"]["hard_negative"] = ",".join(filter(None, [rec["truth"]["hard_negative"], "forgetful_login"]))

        lone_traits = {}
        for _ in range(n_lone):
            for t in self.plant_lone(normals):
                lone_traits[t] = lone_traits.get(t, 0) + 1

        # Shuffle, then assign IDs so neither order nor ID reveals a ring.
        self.r.shuffle(self.records)
        for idx, rec in enumerate(self.records, start=1):
            rec["row"] = {"beneficiary_id": f"B-{idx:06d}", "application_id": f"APP{self.r.randint(10 ** 9, 10 ** 10 - 1)}",
                          "scheme": SCHEME, **rec["row"]}
            rec["truth"] = {"beneficiary_id": rec["row"]["beneficiary_id"], **rec["truth"]}

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
TRUTH_COLUMNS = ["beneficiary_id", "label", "ring_id", "ring_type", "ghost_traits", "hard_negative", "held_out", "household_id"]

COLUMN_DOCS = [
    ("Identity", [
        ("full_name, father_name, spouse_name", ["ring"], "Fuzzy + phonetic matching for name variants of one identity"),
        ("dob, age, gender", ["ring"], "Same DOB + same father across 'different' people"),
        ("aadhaar_number", ["ring", "lone"], "Duplicates (ring); Verhoeff checksum / format validity (lone)"),
        ("aadhaar_status", ["lone"], "Expired or deactivated Aadhaar still receiving money"),
        ("biometric_hash", ["ring"], "Same biometric enrolled under different names"),
    ]),
    ("Contact", [
        ("phone", ["ring", "lone"], "Shared or sequential batch numbers (ring); malformed or duplicated (lone)"),
        ("email", ["ring"], "Templated addresses on disposable domains"),
        ("address_line, village_town, district, state, pincode", ["ring"], "Unrelated people at one address, with format variants"),
    ]),
    ("Registration", [
        ("registration_ip, registration_channel", ["ring"], "Many registrations from one IP in a short burst (CSC centres are legitimate)"),
        ("registration_ts, application_ts", ["ring"], "Burst timing"),
        ("login_attempts_failed, login_success, login_window_minutes", ["lone"], "Many failed logins then success (account takeover)"),
    ]),
    ("Payment", [
        ("bank_name, bank_account_number, ifsc", ["ring"], "Many identities paying out to one account"),
        ("upi_id, payout_mode", ["ring"], "One collector UPI ID for many beneficiaries"),
        ("amount_inr, payout_ts", ["ring", "lone"], "Money at risk"),
    ]),
]


def write_csv(path, columns, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=20000)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    g = Generator(args.rows, args.seed)
    rings, lone_traits = g.build()
    records = g.records

    write_csv(OUT / "ledger.csv", LEDGER_COLUMNS, [r["row"] for r in records])
    write_csv(OUT / "truth.csv", TRUTH_COLUMNS, [r["truth"] for r in records])

    ring_types = {}
    for ring in rings:
        t = ring_types.setdefault(ring["type"], {"type": ring["type"], "count": 0, "members": 0,
                                                  "signals": ring["signals"], "heldOut": ring["heldOut"]})
        t["count"] += 1
        t["members"] += ring["size"]
    hard = {}
    for r in records:
        for tag in filter(None, r["truth"]["hard_negative"].split(",")):
            hard[tag] = hard.get(tag, 0) + 1
    labels = {}
    for r in records:
        labels[r["truth"]["label"]] = labels.get(r["truth"]["label"], 0) + 1

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    planted = {
        "rows": len(records), "seed": args.seed, "generatedAt": generated_at, "labels": labels,
        "rings": len(rings), "ringTypes": list(ring_types.values()), "ringList": rings,
        "loneGhosts": labels.get("lone", 0), "loneTraits": lone_traits, "hardNegatives": hard,
    }
    (OUT / "planted.json").write_text(json.dumps(planted, indent=2), encoding="utf-8")

    type_desc = {
        "account_funnel": "Unrelated identities paying out to 1-2 bank accounts, registered in a burst from one IP",
        "upi_collector": "Payouts routed to one collector UPI ID; templated disposable emails",
        "biometric_clone": "Same biometric under different names and Aadhaar numbers; same DOB and father",
        "ip_farm": "Burst of registrations from one IP with sequential phones and templated emails",
        "phone_batch": "Sequential phone numbers paying into a shared account",
        "address_cluster": "Unrelated surnames at one address (with spelling variants) sharing an account",
        "slow_drip": "Held out: same IP spread over days plus a shared address (weak signals only)",
        "identity_reuse": "Held out: name variants with the same DOB/father and batch phones, no shared money trail",
    }
    hard_desc = {
        "csc_shared_ip": "Genuine applicants registering at a CSC centre (shared IP)",
        "family_shared_address": "Family members at one address",
        "family_shared_phone": "Siblings using a parent's phone",
        "family_shared_account": "Siblings paid into a parent's account",
        "forgetful_login": "Honest users with 5-7 failed logins over a long window",
    }
    dataset_info = {
        "name": f"{SCHEME} (simulated)",
        "simulated": True,
        "recordCount": len(records),
        "generatedAt": generated_at,
        "description": "Synthetic scholarship ledger. Names, addresses, phones, Aadhaar numbers (valid Verhoeff checksums) "
                       "and bank details follow realistic Indian formats. Families and CSC centres create legitimate sharing. "
                       "Ring and lone ghosts were planted afterwards with labels kept in a separate file the detector never reads.",
        "columnGroups": [{"group": g_name, "columns": [{"name": n, "usedFor": u, "description": d} for n, u, d in cols]}
                         for g_name, cols in COLUMN_DOCS],
        "planted": {
            "rings": len(rings),
            "ringTypes": [{"type": t["type"], "count": t["count"], "description": type_desc[t["type"]]} for t in ring_types.values()],
            "loneGhosts": labels.get("lone", 0),
            "loneTraits": lone_traits,
            "hardNegatives": [{"type": k, "count": v, "description": hard_desc.get(k, k)} for k, v in hard.items()],
        },
        "howCreated": [
            "Generated households of students with realistic names, DOBs, addresses, phones, Aadhaar numbers and bank accounts.",
            "Added legitimate sharing: families (address, phone, account), CSC centres (shared IP), forgetful users (failed logins).",
            f"Planted {len(rings)} rings across {len(ring_types)} types and {labels.get('lone', 0)} lone ghosts with 5 trait types.",
            "Held two ring types (slow_drip, identity_reuse) out of tuning to test generalisation.",
            "Shuffled records and assigned IDs afterwards so order and IDs reveal nothing.",
        ],
        "pipeline": [
            {"step": "Blocking", "description": "Group records by pincode, phone prefix and name initials."},
            {"step": "Linkage", "description": "Fuzzy + phonetic names; exact match on account, UPI, biometric, phone, IP, email pattern."},
            {"step": "Graph", "description": "Records and shared items become nodes; shared attributes become weighted edges."},
            {"step": "Ring discovery", "description": "Connected components, Louvain, IP burst windows, weighted ring score."},
            {"step": "Lone scoring", "description": "Aadhaar checksum and status, phone validity and duplication, login behaviour."},
            {"step": "Explain", "description": "Top contributing signals become reasons and red table cells."},
        ],
        "limitations": [
            "Real welfare fraud labels are not public, so the ledger is simulated.",
            "Results are on simulated fraud plus component benchmarks, not on real welfare data.",
        ],
    }
    (OUT / "dataset_info.json").write_text(json.dumps(dataset_info, indent=2), encoding="utf-8")

    print(f"rows={len(records)} labels={labels}")
    print(f"rings={len(rings)} types={ {k: v['count'] for k, v in ring_types.items()} }")
    print(f"lone traits={lone_traits}")
    print(f"hard negatives={hard}")


if __name__ == "__main__":
    main()
