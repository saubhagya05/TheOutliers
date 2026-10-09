# Dataset & Benchmark Results

Source of truth for the Dataset section of the app and the pitch deck. Numbers come from `python ml/benchmark.py` and `python ml/benchmarks/febrl.py` (results also in `ml/data/benchmarks.json`). Run date: 2026-10-09.

---

## Slide-ready headlines

- **The unique-ID check catches 0 rings. Our graph catches 35 of 35** on a held-out test set (precision 0.97).
- **Both ring types we never tuned on were found** (7 of 7 rings).
- **Lone ghosts: F1 0.91** (precision 0.93, recall 0.89) on the held-out test set.
- **Validated on public data:** our record-linkage matcher scores **F1 0.994–0.998 on Febrl**, a standard public benchmark, on sets never used for tuning. A plain unique-key check misses 4–10% of the same duplicates.
- **Money-flow detection on real public AML data (IBM, 4.5 million transfers):** our cycle detector found **36 of 54** labelled laundering cycles, and **45% of the cycles it flags are real laundering**, about **30x better than random**. No tuning on this data.
- **High throughput:** 200,000 records + 176,000 money transfers audited in **53 seconds** on a laptop (about 3,800 records/second).

---

## 1. Why a simulated dataset

Real welfare fraud labels are not public (beneficiary data is private and fraud cases are confidential). We therefore built a **calibrated simulation** with known answers, and **validated the matching component on public benchmark data** (section 5).

## 2. The dataset

| | Dev set (tuning) | Test set (held out) |
|---|---|---|
| Beneficiary records | 20,000 | 20,000 |
| Post-payout money transfers | 17,667 | 17,536 |
| Planted rings (members) | 31 (406) | 35 (506) |
| Planted lone ghosts | 240 | 200 |
| Seed | 7 | 11 |

**Columns (what an auditor's system would hold):** name, father's name, spouse's name, gender, DOB, age, Aadhaar number (synthetic, valid Verhoeff checksum) and status, biometric hash, phone, email, address (line, town, district, state, pincode), registration IP and channel (self / CSC), registration and application time, bank account, IFSC, UPI ID, payout mode, amount, payout time, failed login attempts and login window. Plus a separate **transfers** table (from account, to account, amount, time, channel).

**Ring types planted (9):**

| Type | How the ring is linked | Held out of tuning |
|---|---|---|
| account_funnel | 1–2 shared bank accounts, registrations in a burst from one IP | |
| upi_collector | One collector UPI ID, templated disposable emails | |
| biometric_clone | Same biometric under different names and Aadhaar numbers, same DOB and father | |
| ip_farm | Registration burst from one IP, batch phone numbers, templated emails | |
| phone_batch | Batch phone numbers paying into a shared account | |
| address_cluster | Unrelated surnames at one address (spelling variants), shared account | |
| kickback_cycle | 60–90% of payouts forwarded to a collector; agents pay commissions back (money cycles) | |
| slow_drip | Same IP spread over days + shared address (weak signals only) | ✅ |
| identity_reuse | Name variants, same DOB / father, batch phones, no shared money trail | ✅ |

**Lone-ghost traits (5):** invalid Aadhaar (checksum / format), expired or deactivated Aadhaar, invalid phone, phone duplicated from an unrelated person, login brute force (many failures quickly, then success).

## 3. How we kept the benchmark honest (bias controls)

1. **Legitimate look-alikes for every signal**, so the detector cannot win with one rule (dev set counts):

   | Legitimate pattern | Records | Looks like |
   |---|---|---|
   | CSC centre registrations (shared IP) | 5,783 | shared-IP rings |
   | Families sharing an address | 5,338 | address clusters |
   | Students paying college fees (many-to-one money) | 4,844 | collector accounts |
   | Siblings using a parent's phone | 1,998 | shared phones |
   | Siblings paid into a parent's account | 669 | shared accounts |
   | Twins (same DOB, father, address, rhyming names) | 444 | identity clones |
   | Genuine phone typos / Aadhaar typos | 39 / 37 | invalid phone / Aadhaar |
   | Aadhaar expired pending update | 43 | expired Aadhaar |
   | Forgetful users (many failed logins, slowly) | 35 | login brute force |

   With these in place, any single lone-ghost rule alone catches only about 30% of ghosts and raises false alarms.
2. **Noisy rings:** each signal is carried by only 60–95% of a ring's members (50–85% in the test set), sequences have gaps, some members live in other districts.
3. **Two ring types held out** of all tuning.
4. **Separate test set** with a different seed and shifted ring sizes, noise and rates. All tuning used the dev set only (`--dev-only`); the test set was run once for the reported numbers.
5. **No ID leakage:** records are shuffled before IDs are assigned; everyone (ghosts included) makes ordinary shop payments.

## 4. Results on our simulated ledger

**Headline = held-out test set.**

| Metric | Test set (headline) | Dev set (tuning) |
|---|---|---|
| Rings found | **35 / 35** | 31 / 31 |
| Ring false alarms | **1** | 4 |
| Ring precision / recall / F1 | **0.97 / 1.00 / 0.99** | 0.89 / 1.00 / 0.94 |
| Ring-member precision / recall / F1 | 0.99 / 0.90 / 0.94 | 0.95 / 0.95 / 0.95 |
| Lone ghosts found | 178 / 200 | 202 / 240 |
| Lone false alarms | 13 | 9 |
| Lone precision / recall / F1 | **0.93 / 0.89 / 0.91** | 0.96 / 0.84 / 0.90 |

A planted ring counts as found when one reported ring (risk ≥ 40) contains at least half of its members and at least half of that reported ring belongs to it.

**Rings found by type (test set):**

| Type | Found |
|---|---|
| account_funnel | 4 / 4 |
| address_cluster | 4 / 4 |
| biometric_clone | 4 / 4 |
| ip_farm | 4 / 4 |
| kickback_cycle | 4 / 4 |
| phone_batch | 4 / 4 |
| upi_collector | 4 / 4 |
| slow_drip (held out) | 4 / 4 |
| identity_reuse (held out) | 3 / 3 |

**Baseline comparison:** a unique Aadhaar / ID check flags **0** records and **0** rings in this data: every ghost carries a distinct, valid-looking ID. This is exactly the blind spot named in the problem statement.

**Throughput:**

| Run | Records | Transfers | Time | Records / second |
|---|---|---|---|---|
| Standard | 20,000 | 17,536 | 3.5 s | 5,714 |
| Scale test | 200,000 | 176,497 | 52.6 s | 3,802 |

## 5. Public benchmark: Febrl

**What:** Febrl (Freely Extensible Biomedical Record Linkage) is a standard public record-linkage benchmark: person records (name, address, DOB, ID number) with realistic typos and known duplicate pairs. Loaded via the `recordlinkage` Python package.

**What we tested:** our record-linkage matcher, using the same signals as the pipeline (Levenshtein name similarity, phonetic match, DOB, normalised address, ID number), with multi-key blocking. The match threshold was chosen on **Febrl1 only**; Febrl2–4 were never used for tuning.

| Dataset | True duplicate pairs | Precision | Recall | F1 | Unique-key check recall |
|---|---|---|---|---|---|
| Febrl2 | 1,934 | 0.997 | 0.995 | **0.996** | 0.914 |
| Febrl3 | 6,538 | 1.000 | 0.988 | **0.994** | 0.904 |
| Febrl4 (linking two files) | 5,000 | 0.999 | 0.997 | **0.998** | 0.956 |

## 5b. Public benchmark: IBM Transactions for Anti Money Laundering

**What:** IBM's synthetic AML dataset (Kaggle, "HI-Small"): **4,487,133 transfers** between 422,734 accounts after removing self-transfers, with 5,177 laundering transactions. A patterns file labels every laundering attempt by type (fan-in, fan-out, cycle, scatter-gather, ...). Laundering accounts are 1.5% of all accounts, so random flagging would be right 1.5% of the time.

**What we tested:** the two money-flow detectors from our pipeline, with **the same constants and no tuning on this data**:
- **Collector / fan-in** (scored on the 40 FAN-IN patterns): an account receiving from 3+ distinct senders within 24 hours, ignoring public hubs (accounts with more than 30 partners; 518 here). IBM data has no scholarship payout, so "within 24 h of payout" becomes "within a 24 h window".
- **Cycle detection** (scored on the 54 CYCLE patterns): bounded simple cycles (up to 10 hops) on the transfer graph without public hubs.

| Detector | Patterns found (recall) | Precision of what it flags | Lift over random | Run time |
|---|---|---|---|---|
| Cycle detection (kickbacks) | **36 / 54 (0.67)** | **0.454** of flagged cycles are laundering | **30x** | 4.3 min |
| Collector / fan-in rule alone | **36 / 40 (0.90)** | 0.034 of flagged accounts (42,079 flagged) | 2.3x | 20 s |

**How to read this:**
- **Cycles are a strong signal on their own:** nearly half of every cycle we flag is real laundering.
- **Fan-in alone is a weak signal:** it finds 90% of laundering collectors but also flags tens of thousands of ordinary accounts, because many-to-one money is everywhere. This is exactly why our pipeline never flags a collector on fan-in alone: it also requires fast forwarding of most of a payout, and linked identities. (Our own data shows the same thing: 4,844 genuine college-fee payments fan in and are correctly not flagged.)
- **Most missed cycles sit in one giant connected cluster of 16,495 accounts,** where exhaustive search is too slow; we cap it at 4 minutes. A time-ordered cycle search would recover more.

## 6. Limitations (say these out loud; judges respect it)

- Ring and lone-ghost results are on **our simulated ledger**. Bias controls, held-out types and a shifted test set reduce, but do not remove, the risk that the detector fits the generator.
- Name lists and typo rules in the simulation are hand-made, not drawn from real population data.
- **Febrl is a fairly clean, well-known benchmark** (strong matchers typically exceed 0.99), and it has no father's name, so it tests the name / DOB / address / ID part of the matcher only.
- **IBM AML** is itself synthetic (generated by IBM's AMLworld simulator), and its accounts have no identity data, so it tests only the money-flow part. Fan-in had to drop the "after payout" condition, which makes it much noisier than in our pipeline. Cycle search in the giant component is time-capped, so cycle recall is a lower bound.

## 7. Reproduce

```bash
python ml/data/generate_dataset.py                    # dev set
python ml/data/generate_dataset.py --profile test     # held-out test set
python ml/benchmark.py                                # simulated-ledger results -> ml/data/benchmarks.json
pip install recordlinkage && python ml/benchmarks/febrl.py   # public benchmark -> benchmarks.json "public"
python ml/benchmarks/ibm_aml.py   # needs HI-Small_Trans.csv + HI-Small_Patterns.txt in ml/data/public/ibm_aml/ (about 5 min)
python ml/data/generate_dataset.py --rows 200000 --out ml/data/scale && python ml/benchmark.py --scale ml/data/scale
```
