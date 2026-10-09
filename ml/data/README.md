# Data

Put the generated ledger here as `ledger.csv`, plus `dataset_info.json` and `benchmarks.json` (same shapes as `GET /api/dataset` and `GET /api/benchmarks` in `docs/API.md`).

## `ledger.csv` columns

| Column | Example | Notes |
|---|---|---|
| recordId | B-000123 | unique |
| name | Rajesh Kumar | |
| age | 20 | |
| gender | M / F | |
| phone | 9812345621 | raw; ML masks it before output |
| address | Ward 4, Rajgir | |
| district | Nalanda | |
| pincode | 803116 | string |
| aadhaarHash | a91f3c... | hashed, never raw |
| payoutAccount | SBI ****4521 | |
| ifsc | SBIN0004521 | |
| transferredTo | PNB ****7712 | empty if funds were not forwarded |
| agentId | AG-07 | |
| deviceId | D-0312 | OTP device |
| otpIp | 10.4.2.17 | |
| accountOpenedAt | 2025-08-10T00:00:00Z | |
| appliedAt | 2025-08-14T10:02:00Z | |
| payoutAt | 2025-08-20T09:00:00Z | |
| amountInr | 90000 | integer |
| minutesToWithdrawal | 7 | |
| enrolledInRegistry | true | simulated registry cross-check |

Ground truth goes in **separate** columns or a separate file (`is_ghost`, `ring_label`, `ghost_type`). `pipeline/load.py` drops them before detection; only the benchmark script may read them.

Large files (> 50 MB) should not be committed; share them over the team drive instead.
