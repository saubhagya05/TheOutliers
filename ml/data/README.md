# Data

Regenerate everything (stdlib only, a few seconds), from the repo root:
```bash
python ml/data/generate_dataset.py                    # dev set (seed 7): tune here      -> ml/data/
python ml/data/generate_dataset.py --profile test     # test set (seed 11, shifted)      -> ml/data/test/
python ml/data/generate_dataset.py --rows 200000 --out ml/data/scale   # throughput run (do not commit)
python ml/data/build_mock_bundle.py                   # rebuild backend/src/mock/bundle.json after any dev change
```

| File | Who reads it |
|---|---|
| `ledger.csv` | The detector (`pipeline/load.py`). No labels. |
| `transfers.csv` | The detector (`pipeline/load.load_transfers`): money moved after payout, for collector and cycle detection. |
| `truth.csv` | **Only** the benchmark script and `build_mock_bundle.py`. Never the detector. |
| `planted.json` | Summary of planted rings, lone ghosts and hard negatives. |
| `dataset_info.json` | Served as `GET /api/dataset` (Dataset & Method page). |
| `test/` | Same files for the held-out test set. **Tune on dev, run test once**, report the test numbers. |

All identities are synthetic. Aadhaar numbers are fake but carry valid Verhoeff checksums, so checksum validation is meaningful.

## Bias controls
- **Legitimate look-alikes for every signal:** families (shared address, phone, account), twins (same DOB, father, address, rhyming names), CSC centres (shared IP), college fee accounts (legit fan-in of money), genuine phone typos, Aadhaar typos (checksum fails), expired-but-genuine Aadhaar, forgetful logins. No single rule separates ghosts from genuine people.
- **Noisy rings:** each signal is carried by only 60-95% of a ring (50-85% in test), sequences have gaps, some members live in other districts.
- **Held-out ring types** (`slow_drip`, `identity_reuse`) and a **shifted test set** (different seed, ring sizes, noise and rates).
- **No ID leakage:** records are shuffled before IDs are assigned; shop payments go to everyone, ghosts included.
- **Still a simulation:** name lists and typo rules are hand-made, not real distributions. Validate the matcher on public data (Febrl / NCVR) too.

## `ledger.csv` columns

| Column | Example | Used for |
|---|---|---|
| beneficiary_id | B-000123 | id (assigned after shuffling, reveals nothing) |
| application_id | APP5167104572 | id |
| scheme | Post-Matric Scholarship 2025-26 | |
| full_name | Rajesh Kumar | ring: fuzzy + phonetic name variants |
| father_name | Ram Prasad Kumar | ring: same father across "different" people |
| spouse_name | (often empty) | ring |
| gender | M / F | |
| dob | 2004-03-24 | ring: same DOB |
| age | 21 | |
| aadhaar_number | 290405206266 | ring: duplicates; lone: Verhoeff checksum / format |
| aadhaar_status | active / expired / deactivated | lone |
| biometric_hash | 5b57cf92ae26bbbb702150fb | ring: same biometric, different identities |
| phone | 7789907821 | ring: shared / sequential; lone: malformed / duplicate |
| email | sapna_khan@gmail.com (often empty) | ring: templated on disposable domains |
| address_line, village_town, district, state, pincode | House 30, Ward 6 · Islampur · Nalanda · Bihar · 803171 | ring: shared address with format variants |
| registration_ip | 157.38.25.93 | ring: burst from one IP |
| registration_channel | self / CSC | context: CSC centres legitimately share an IP |
| registration_ts, application_ts | 2025-07-23T15:32:23Z | ring: burst timing |
| bank_name, bank_account_number, ifsc | SBI · 3459844017018341 · SBIN0841692 | ring: shared account |
| upi_id | cash412@ybl (often empty) | ring: collector UPI |
| payout_mode | DBT_BANK / UPI | |
| amount_inr | 36000 | ₹ at risk |
| payout_ts | 2025-09-15T09:00:00Z | |
| login_attempts_failed, login_success, login_window_minutes | 14 · True · 6 | lone: many failures then success |

Empty strings mean "not provided". **Ignore empty values when looking for shared attributes** (for example, 45% of `upi_id` and 35% of `email` are empty).

## `truth.csv` columns
`beneficiary_id, label (normal | ring | lone), ring_id, ring_type, ghost_traits, hard_negative, held_out, household_id`

## `transfers.csv` columns
`transfer_id, from_account, to_account, amount_inr, ts, channel (UPI | IMPS | NEFT)`. Accounts are full account numbers; beneficiary accounts match `ledger.bank_account_number`, others are external (collectors, agents, colleges, shops).

## What is planted (dev run)
- **31 rings, 406 members, 9 types.** `account_funnel`, `upi_collector`, `biometric_clone`, `ip_farm`, `phone_batch`, `address_cluster` and `kickback_cycle` are used for tuning. **`slow_drip` and `identity_reuse` are held out**: do not tune on them.
- **240 lone ghosts**, each with 1-2 traits: `invalid_aadhaar`, `expired_aadhaar`, `invalid_phone`, `duplicate_phone`, `login_bruteforce`. Ghosts also register at odd hours and skip email more often (weak correlates).
- **Hard negatives** (legitimate, must NOT be flagged): see Bias controls. Counts per type are in `planted.json`.
