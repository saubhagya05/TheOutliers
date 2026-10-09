# Progress

One shared log for the whole team. **Update your own section whenever you open a PR**: move items between Done / In progress / Next, add a line to the log at the bottom, and note any blocker.

Status keys: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked

## Overall status

| Area | Owner | Status | Notes |
|---|---|---|---|
| Idea, scope, page flow | Team | ✅ | Problem 4: ghost-beneficiary detection (rings first, lone ghosts second) |
| API contract (`docs/API.md`) | Backend lead | ✅ | v3, matches the final dataset |
| Task split (`docs/TASKS.md`) | Backend lead | ✅ | |
| Repo scaffold (frontend / backend / ml) | Backend lead | ✅ | |
| Dataset + bias controls | Backend lead | ✅ | dev set + held-out test set, transfers for kickback cycles |
| Express backend (mock + live) | Backend lead | ✅ | every endpoint works; flag/deflag in memory |
| ML pipeline (FastAPI) | Backend lead | ✅ | rings, lone ghosts, money cycles, stress test, benchmarks |
| Landing + Dataset & Method pages | Person A | 🟡 | Landing done (merged); StatStrip, BaselineStrip and Dataset page still TODO |
| Shared look (theme, nav, shared components) | Person A | 🟡 | theme + nav merged; nav now has Home + Dataset only |
| Ring Threats page | Person B | ✅ | constellation, list, detail, record drawer, case brief, baseline overlay, stress test, timeline merged |
| Lone Threats page | Person C | 🟡 | point cloud, network graph, stats and charts merged; updated to API v3 signals |
| End-to-end demo on live ML | Team | ⬜ | |
| Pitch deck + demo script + backup video | Team | ⬜ | |

## Key numbers (held-out test set, `python ml/benchmark.py`)

| | Precision | Recall | F1 |
|---|---|---|---|
| Rings (35 planted, 1 false alarm) | 0.97 | 1.00 | 0.99 |
| Lone ghosts | 0.93 | 0.89 | 0.91 |

- Both held-out ring types (`slow_drip`, `identity_reuse`) found.
- Unique-ID baseline: catches **0** rings.
- Throughput: 20,000 records in about 4–7 s; 200,000 records + 176,000 transfers in 53-77 s depending on laptop load.
- **Public benchmark (Febrl2-4, real benchmark data with known duplicates):** matcher F1 0.994-0.998 (precision 0.997-1.0, recall 0.988-0.997); a unique-key check finds only 90-96% of duplicates. Threshold set on Febrl1 only.
- Honest caveats: ring numbers are on our simulated ledger; Febrl is a well-known, fairly clean benchmark and has no father's name; IBM AML is also synthetic and has no identity data; fan-in alone is a weak signal there (precision 0.03).

---

## Backend lead (Express + ML + dataset)

**Done**
- ✅ `docs/API.md` v3 and `docs/TASKS.md`; frontend API client (`frontend/src/api/client.js`) with every call.
- ✅ Express API: all endpoints, mock mode (oracle bundle built from the real dataset) and live mode (`MOCK=false`), in-memory flag / confirm / deflag / undo with counts that update.
- ✅ Dataset generator (`ml/data/generate_dataset.py`): 20,000 records, 31 rings across 9 types, 240 lone ghosts, 17,667 transfers. Legitimate look-alikes for every signal (families, twins, CSC centres, college fee accounts, typos, expired-but-genuine Aadhaar, forgetful logins), noisy rings, 2 held-out ring types, separate test set.
- ✅ ML pipeline (`ml/pipeline/`): linkage (exact hubs, IP bursts, batch phones, email templates, addresses, Levenshtein + phonetic identities), money graph (collector fan-in, cycle detection), weighted graph + Louvain, explainable ring risk index, lone scoring (noisy-OR + Isolation Forest + PCA), case brief, stress test.
- ✅ `ml/benchmark.py`: dev + test + scale run → `ml/data/benchmarks.json`, shown on the Dataset page.
- ✅ Live mode verified end to end (ML → Express → UI), all 11 FastAPI endpoints tested.

**In progress**
- 🟡 Answering contract questions and reviewing PRs.

**Next**
- ⬜ Persist flag/deflag decisions to a JSON file so a restart keeps them.
- ⬜ Optional LLM rewrite of the case brief (key server-side only).
- ✅ Public benchmark of the matcher on Febrl2-4 (`ml/benchmarks/febrl.py`), shown on the Dataset page.
- ✅ Public benchmark of the money-flow detectors on IBM AML (4.5M transfers): cycles 36/54 found, 45% of flagged cycles are laundering (30x random); fan-in alone 36/40 found but noisy (2.3x random).
- ⬜ Help with integration and the demo script.

**Blockers:** none.

---

## Person A: Dashboard (Landing, Dataset & Method, shared look)

**Done**
- ⬜

**In progress**
- ⬜

**Next** (from `docs/TASKS.md`)
- ⬜ Shared look first: theme, TopNav, RiskBadge, ReasonChips, StatusActions, AnomalyTable, States
- ⬜ Landing: hero, ThreatCards, StatStrip, BaselineStrip, two big buttons
- ⬜ Dataset & Method: DatasetCard, BenchmarkTable (show test set, held-out types, records/second)

**Blockers:**

---

## Person B: Ring Threats

**Done**
- ⬜

**In progress**
- ⬜

**Next** (from `docs/TASKS.md`)
- ⬜ ConstellationGraph: coloured rings, select to brighten / dim the rest, transfer edges with particles (kickback cycles)
- ⬜ RingList polish + filters, Prioritise
- ⬜ RingDetailPanel: signal breakdown, shared entities, member table with red cells, member deflag, record drawer
- ⬜ BaselineToggle, CaseBriefModal
- ⬜ Star: StressTestDrawer, timeline

**Blockers:**

---

## Person C: Lone Threats

**Done**
- ⬜

**In progress**
- ⬜

**Next** (from `docs/TASKS.md`)
- ⬜ PointCloud: glowing flagged points, select to brighten / dim the rest
- ⬜ LoneList: signal filter chips, red cells, flag / deflag
- ⬜ LoneDetailPanel: feature bars (this vs typical), fields with red cells
- ⬜ RecordSearch polish (debounce, keyboard)

**Blockers:**

---

## Log

Newest first. One line per PR or milestone: `date · who · what`.

- 2026-10-09 · Backend lead · Merged all three frontend branches into main; fixed Lone page to API v3 names, moved Person A's uploaded files into frontend/src, fixed a CSS class clash
- 2026-10-09 · Backend lead · Public benchmark on IBM AML (cycles 30x better than random, fan-in recall 0.90)
- 2026-10-09 · Backend lead · Public benchmark on Febrl2-4 (matcher F1 0.994-0.998)
- 2026-10-09 · Backend lead · ML pipeline + benchmark merged; live mode works end to end
- 2026-10-09 · Backend lead · Dataset v2 (bias controls, transfers, test set); API v3; mock serves real data
- 2026-10-09 · Backend lead · Dataset generator v1
- 2026-10-09 · Backend lead · Scaffold, API contract, task split pushed; team cloned the repo
