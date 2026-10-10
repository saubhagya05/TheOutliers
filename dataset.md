# Dataset: how we built it, removed bias, split it and benchmarked it

Full numbers: `docs/dataset_bench.md`. Generator: `ml/data/generate_dataset.py`.

## 1. Why we built our own dataset
Real welfare fraud data is private and has no public labels. So we **simulated a scholarship ledger whose answers we know**. We then checked the parts that real public data can test (record matching, money flow) on **public benchmarks**.

## 2. What is in it
- **20,000 beneficiaries, 33 fields**, the fields a government system really holds: name, father, DOB, gender, Aadhaar (synthetic, valid checksum) and its status, biometric hash, phone, email, address, registration IP and channel (self or CSC), bank account, UPI, payout, failed logins.
- **17,667 money transfers** made after the payouts (`transfers.csv`).
- **31 ring ghosts** (406 members) of **9 types**: shared account, UPI collector, biometric clone, IP farm, phone batch, address cluster, kickback cycle, slow drip, identity reuse.
- **240 lone ghosts** with 5 traits: invalid Aadhaar, expired Aadhaar, invalid phone, phone duplicated from an unrelated person, login brute force.
- The labels sit in a separate `truth.csv`. The detector never sees it; only the benchmark script reads it.

## 3. How we removed bias
1. **An innocent look-alike for every fraud signal**, so no single rule can win:
   - CSC centres share an IP.
   - Families share an address, phone or account.
   - Twins share DOB, father and address.
   - College fees create many-to-one money.
   - Genuine people make typos, have an expired Aadhaar, or forget their password.

   About 19,000 such hard-negative records are planted.
2. **Noisy rings:** only 60–95% of a ring's members carry each signal, sequences have gaps, and some members live in other districts.
3. **Two ring types held out** (`slow_drip`, `identity_reuse`). They were never used while building or tuning the detector.
4. **No ID leakage:** records are shuffled before IDs are assigned, and ghosts also make ordinary shop payments.
5. **Synthetic identities only:** no real person's data.

## 4. Train / test split
The detector is rule-based and graph-based with unsupervised ML (Isolation Forest), so no model is fitted on labels. The "training" set is where we **tuned the thresholds**:

| | Dev set (tune) | Test set (report) |
|---|---|---|
| Records | 20,000 | 20,000 |
| Rings / lone ghosts | 31 / 240 | 35 / 200 |
| Random seed | 7 | 11 |
| Ring size | 5–18 | 4–25 (shifted) |
| Signal coverage in a ring | 60–95% | 50–85% (harder) |

- The test set is generated separately, with a **different seed and a shifted distribution**, not cut from the dev set.
- All tuning used the dev set only. The test set was run **once** for the reported numbers.

## 5. Benchmarking
| Benchmark | What it tests | Result |
|---|---|---|
| **Our test set** (held out) | full pipeline | Rings **35/35**, 1 false alarm (precision 0.97). Lone ghosts **F1 0.91**. Both held-out ring types found. |
| Unique-ID check (baseline) | what schemes do today | **0 rings** caught |
| **Febrl 2–4** (public) | identity matching | **F1 0.994–0.998**. Threshold chosen on Febrl1 only. |
| **IBM AML** (public, 4.5M transfers) | money-flow detection | Cycles: 36/54 found, 45% of flags are real (**30× random**). No tuning on this data. |
| Scale run | speed | **200,000 records in 53–77 s** on a laptop |

A ring counts as found when one reported ring holds at least half of its members, and at least half of that reported ring belongs to it.

**Limitation:** ring and lone results come from our simulation. Look-alikes, held-out types and a shifted test set reduce the risk of fitting our own generator, but don't remove it. That is why the matching and money-flow parts are also checked on public data.

## Reproduce
```bash
python ml/data/generate_dataset.py                  # dev set
python ml/data/generate_dataset.py --profile test   # test set
python ml/benchmark.py                              # scores
```
