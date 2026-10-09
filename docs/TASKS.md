# Work split

Four people, each owning whole files, so merge conflicts are rare.

| Who | Owns | Branch prefix | Folder(s) |
|---|---|---|---|
| **Person A: Dashboard** | Landing page, Dataset & Method page, shared look (theme, TopNav, shared components) | `a/` | `frontend/src/pages/dashboard/`, `frontend/src/components/`, `frontend/src/styles/` |
| **Person B: Ring** | Ring Threats page | `b/` | `frontend/src/pages/rings/` |
| **Person C: Lone** | Lone Threats page | `c/` | `frontend/src/pages/lone/` |
| **Backend lead** | Express API, ML service, dataset, `docs/API.md`, `frontend/src/api/client.js` | `be/` | `backend/`, `ml/`, `docs/` |

**The backend already runs in mock mode with realistic data and the exact API shapes.** Frontend people do not wait for the dataset or the ML. Start the backend, start the frontend, build.

---

## 0. Everyone: setup (15 min)

```bash
git clone https://github.com/saubhagya05/TheOutliers.git
cd TheOutliers
cd backend && npm install && copy .env.example .env && cd ..
cd frontend && npm install && cd ..
```

Run (two terminals):
```bash
npm --prefix backend run dev      # http://localhost:5000/api  (mock mode)
npm --prefix frontend run dev     # http://localhost:5173
```
Check http://localhost:5000/api/health shows `"mode":"mock"`, then open http://localhost:5173.

Daily git loop:
```bash
git checkout main && git pull
git checkout -b b/constellation-graph     # your prefix + feature
# ...work, small commits...
git push -u origin b/constellation-graph  # then open a PR on GitHub
```

### Rules
1. **Only edit files in your own folder.** Need something in someone else's file? Ask them, or open a PR they review.
2. **Never call `fetch` directly.** Use the functions in `frontend/src/api/client.js`. Missing one? Ask the backend lead.
3. **Never hard-code colours.** Use the CSS variables in `styles/theme.css`. Ring colours come from the API (`ring.color`).
4. **Shapes are in `docs/API.md`.** If the data looks wrong, tell the backend lead; do not patch it in the frontend.
5. **Dashed "TODO" boxes are placeholders.** Replace each one with the real component, and delete the `Todo` import when done.
6. Every list or detail view must handle **loading**, **error** (`ErrorBox`) and **empty** states (`components/States.jsx`).
7. After any flag/deflag call, call the page's `onChanged` / `refreshAll` so counts, colours and lists update.

### Design direction (agreed)
Minimal. **Black, white and red** only, with ring colours as the one exception on the Ring page. Big type, lots of empty space, thin 1px borders, glow on hover and selection, no gradients or shadows elsewhere. Numbers in the mono font.

---

## Person A: Dashboard (Landing + Dataset & Method + shared look)

**Files:** `pages/dashboard/LandingPage.jsx`, `pages/dashboard/DatasetPage.jsx`, `pages/dashboard/components/*`, `components/*`, `styles/theme.css`

**Endpoints:** `getOverview()`, `getBaseline()`, `getDataset()`, `getBenchmarks()` (`GET /api/overview`, `/api/baseline`, `/api/dataset`, `/api/benchmarks`)

### Must
1. **Shared look first (first 1.5 h, others depend on it).** Polish `theme.css`, `TopNav`, `RiskBadge`, `ReasonChips`, `StatusActions`, `AnomalyTable`, `States`. They already work, so make them look final without changing their props. Changing a prop means telling B and C.
2. **Landing hero:** big headline and one-line subline (final copy agreed with the team).
3. **`ThreatCards`:** two cards, Ring ghosts and Lone ghosts: what they are and why they are a threat. A small visual for each (linked dots vs. one isolated dot; a CSS or SVG animation is enough).
4. **`StatStrip`:** records scanned, rings found, ring members, lone ghosts, ₹ at risk (`formatInr`). Big mono numbers, ₹ in red, count-up animation.
5. **`BaselineStrip`:** unique-ID check vs. our system, side by side, plus `baseline.headline`. Left column grey, right column red. This is a key pitch moment.
6. **Two big buttons** at the bottom: "Check projected ring threats" → `/rings`, "Check lone threats" → `/lone` (already wired).
7. **`DatasetCard`** on `/dataset`: description with a "Simulated" badge, column groups table (column, used for ring/lone chips, description), how it was created (numbered), planted fraud summary, pipeline as a horizontal step diagram, limitations.
8. **`BenchmarkTable`:** two big F1 numbers (rings, lone), planted vs. found vs. false alerts, and a public benchmarks table. `public` may be empty, so hide that section if it is.

### Star
- Landing background: slow drifting constellation (decorative, pure CSS/canvas, no API).
- Favicon, page titles, and a 404 that redirects home (already redirects).

**Done when:** Landing and Dataset pages have no TODO boxes, look final, and handle loading and error states.

---

## Person B: Ring Threats

**Files:** `pages/rings/RingsPage.jsx`, `pages/rings/components/*`

**Endpoints:**
| Call | Used for |
|---|---|
| `getRingsGraph({ includeContext: true, contextNodes: 300 })` | constellation |
| `getRings({ sort, pageSize: 100, level, district, status })` | ring list; `sort: 'priorityScore'` = Prioritise |
| `getRing(ringId)` | selected ring detail and member table |
| `setRingStatus(ringId, status, note)` / `clearRingStatus(ringId)` | confirm / deflag / undo a whole ring |
| `setRecordStatus(recordId, status, note)` / `clearRecordStatus(recordId)` | remove (deflag) one member wrongly included, or undo |
| `getRecord(recordId)` | full record drawer from a member row |
| `getRingBrief(ringId)` | case brief |
| `getBaseline()` | baseline overlay numbers |
| `getStressScenarios()` / `runStressTest(scenario)` | stress test drawer (star) |

Page state already wired in `RingsPage.jsx`: `selectedRingId`, `sort`, `baselineView`, `stressOpen`, `refreshAll()`.

### Must
1. **`ConstellationGraph`** with `react-force-graph-2d` (installed). `graphData={{ nodes: data.nodes, links: data.edges }}`.
   - Black canvas, background nodes (`ringId === null`) are tiny faint grey stars.
   - Each ring has its own colour (`data.rings[].color`, map `ringId` → colour), soft glow, so the rings read as different-coloured constellations.
   - Hub nodes (`type` account/phone/agent/device/address) slightly bigger with an outline.
   - Click a node → `onSelectRing(node.ringId)`, click the background → `onSelectRing(null)`.
   - **Selected ring brightens, everything else dims to ~10%**, and the camera zooms to fit that ring.
   - `status: 'deflagged'` nodes are drawn hollow and grey.
   - Hover tooltip: name/label, type, risk.
2. **`RingList`** (basic version works): polished cards, filters (risk level, district, status), priority rank badge when sorted by priority. Deflagged rings dimmed.
3. **`RingDetailPanel`** (basic version works):
   - Header: ring id in its colour, risk badge, members active/total, ₹ at risk, district, status.
   - Summary sentence and reason chips.
   - **Signal breakdown** bars (`ring.signalBreakdown`, value 0-1).
   - **Shared entities** list (account, agent, device… with `linkedMembers`).
   - **Member table** via `AnomalyTable` (already wired): red cells = anomalies (tooltip = why), "More columns" for extra fields, per-row **Deflag / Confirm / Undo** so a wrongly included member can be removed. Counts update via `onChanged`.
   - Row click → drawer with `getRecord(recordId)` (features vs. typical, all reasons).
   - Ring-level Confirm / Deflag / Undo (wired).
4. **`BaselineToggle`:** when on, the graph draws all ring nodes grey ("what a unique-ID check sees") and shows an overlay with `getBaseline()` numbers. When off, colours animate back.
5. **Prioritise button** (wired): sorts by `priorityScore` and shows the rank on each card.
6. **`CaseBriefModal`:** render `brief.sections` as a clean white "paper" document, with Print (`window.print()`) and Copy-markdown (`brief.markdown`) buttons.

### Star (build last)
7. **`StressTestDrawer`:** scenario buttons, then 3 big numbers (before → adapted → recovered) and per-ring bars. Use **All of the above** in the demo; it shows the biggest drop.
8. **Timeline** of applications, payouts and withdrawals for the selected ring (`ring.timeline`).

**Done when:** you can click a ring in the graph, see it light up, read why, inspect members with red cells, remove a wrong member, deflag/confirm the ring, and print a case brief.

---

## Person C: Lone Threats

**Files:** `pages/lone/LonePage.jsx`, `pages/lone/components/*`

**Endpoints:**
| Call | Used for |
|---|---|
| `getLonePoints({ includeNormal: true, normalSample: 600 })` | scatter of sparse points |
| `getLone({ pageSize: 100, signal, level, district, status, sort })` | lone table |
| `getRecord(recordId)` | selected record detail (works for unflagged records too) |
| `searchRecords(q, limit)` | find any record |
| `setRecordStatus(recordId, status, note)` / `clearRecordStatus(recordId)` | flag / confirm / deflag / undo |

Page state already wired in `LonePage.jsx`: `selectedId`, `signal`, `refreshAll()`.

### Must
1. **`PointCloud`** (plain SVG or canvas recommended; `recharts` is installed if preferred):
   - Black background. Normal points tiny and faint; flagged points larger, red, with glow, sized by `riskScore`.
   - Click a point → `onSelect(recordId)`, click the background → `onSelect(null)`.
   - **Selected point brightens and pulses, the rest dim.**
   - `deflagged` = hollow grey, `confirmed` = solid red with white outline.
   - Hover tooltip: record id, risk, top signal.
2. **`LoneList`** (basic version works): `AnomalyTable` with red cells, signal filter chips with counts, risk level filter, row click → detail, per-row Confirm / Deflag / Undo.
3. **`LoneDetailPanel`** (basic version works):
   - Header: name, record id, risk badge, kind, status.
   - Reason chips.
   - **Feature bars**: this record vs. dataset typical (`record.features`), anomalous ones in red.
   - All fields with anomalous ones in red (a vertical key/value list may read better than the one-row table).
   - Flag / Confirm / Deflag / Undo (wired). For an unflagged record found by search, the **Flag** button appears automatically (`status: 'notFlagged'`).
4. **`RecordSearch`** (basic version works): debounce 300 ms, styled dropdown, keyboard navigation, show kind and status per result.

### Star
5. Colour points by top signal, with a legend that doubles as a filter.
6. "Manually flagged" section or badge for records flagged by a human (`manualOverride: true`).

**Done when:** you can click a glowing point, see why it is suspicious with red cells and feature bars, flag/deflag it, and search for any record and flag it manually.

---

## Backend lead: Express + ML + dataset

**Files:** `backend/`, `ml/`, `docs/API.md`, `frontend/src/api/client.js`

Express already serves every endpoint in mock mode (`MOCK=true`), with in-memory overrides (no DB). Your job is to swap the mock for real ML output without changing any response shape.

### Must (in order)
1. **Hour 0:** push this scaffold, confirm all three frontend people run it, and answer contract questions. Any contract change goes to `docs/API.md` first, then `client.js`, then the mock (`backend/src/mock/generate.js`), and gets announced in the chat.
2. **Dataset:** generate `ml/data/ledger.csv` (columns in `ml/data/README.md`) with planted rings, lone ghosts and hard negatives. Keep ground truth in separate columns; `pipeline/load.py` drops them. Also write `ml/data/dataset_info.json`.
3. **ML pipeline** (`ml/pipeline/`), each module has its target shape in the docstring:
   - `linkage.py`: blocking, exact keys, fuzzy and phonetic names.
   - `graph.py`: networkx graph, plus `context_nodes`.
   - `rings.py`: components → Louvain → cycles/fan-in → bursts → ring score, reasons, anomalies (red cells), priority.
   - `lone.py`: rules + IsolationForest, plus PCA points.
   - `explain.py`: `record_details` for every record.
   - `baseline.py`, `stress.py` (star), and `audit.search_records`.
   - Run with `pip install -r ml/requirements.txt` then `uvicorn app:app --reload --port 8000` from `ml/`. It autostarts the audit; `GET /health` shows `auditReady`.
4. **Switch to live:** set `MOCK=false` in `backend/.env` and restart Express. Frontend needs no change. Compare a few responses with mock mode; the shapes must match.
5. **First integration test** about a quarter of the way in, even with a partial pipeline.
6. **Benchmarks:** compare against ground truth, then write `ml/data/benchmarks.json`. Public datasets (Febrl, NCVR, IBM AML) are a star item.

### Star
- LLM case brief in `pipeline/brief.py` (keep the API key in `ml/.env`, never in the frontend). Return `generatedBy: "llm"`.
- Persist overrides to a JSON file so a server restart keeps decisions.

### Notes
- Express merges human decisions over ML output (`backend/src/services/views.js`). ML never stores flag/deflag.
- Ring colours, `activeMemberCount`, filtering, sorting and paging are done in Express.
- If ML is down in live mode, Express returns `502 ML_UNAVAILABLE`; switch back to `MOCK=true` for the demo if needed.

---

## Milestones

| When | What |
|---|---|
| Start + 0:30 | Everyone running mock mode locally |
| Start + 1:30 | Person A ships shared-look PR; B and C pull it |
| ~25% | First integration: real ML for at least rings list + graph |
| ~60% | All must features merged |
| ~75% | **Feature freeze.** Only fixes and polish |
| ~85% | Demo run-through on a clean clone of `main`; record a backup video |
