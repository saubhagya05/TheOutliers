# TheOutliers

Ghost-beneficiary detection for welfare and scholarship schemes. Finds **ring ghosts** (organised groups linked by shared payout accounts, phones, agents, OTP devices, timing and money flow) and **lone ghosts** (single suspicious records), and explains every flag.

## Structure
- `frontend/`: React + Vite. Pages: Landing, Ring threats, Lone threats, Dataset & method.
- `backend/`: Express API. Serves realistic **mock data** by default, or real results from the ML service.
- `ml/`: FastAPI service running the detection pipeline.
- `docs/API.md`: API contract (frontend ↔ Express ↔ ML). **Read this first.**
- `docs/TASKS.md`: who builds what.
- `PROGRESS.md`: what is done; every member updates their section with each PR.

## Run (mock mode, no ML needed)
```bash
cd backend && npm install && copy .env.example .env && cd ..
cd frontend && npm install && cd ..
npm --prefix backend run dev
npm --prefix frontend run dev
```
Open http://localhost:5173. API health: http://localhost:5000/api/health.

## Run with the ML service (real detection)
```bash
cd ml
pip install -r requirements.txt
uvicorn app:app --port 8000
```
It runs the audit on startup (about 4 seconds for 20,000 records); `http://localhost:8000/health` shows `"auditReady": true`.
Then set `MOCK=false` in `backend/.env` and restart the backend.

## Benchmark
```bash
python ml/benchmark.py                 # dev + held-out test set -> ml/data/benchmarks.json (shown on the Dataset page)
python ml/data/generate_dataset.py --rows 200000 --out ml/data/scale && python ml/benchmark.py --scale ml/data/scale
```
Held-out test set: rings P 0.97 / R 1.0 (35/35, both held-out ring types found), lone ghosts F1 0.91.
Throughput: 200,000 records + 176,000 transfers in about 53 s on a laptop.

## Detection pipeline (`ml/pipeline/`)
1. **Linkage** (`linkage.py`): exact hubs (account, UPI, biometric, phone), IP burst windows, sorted-neighbourhood
   batch phones, email templates, normalised addresses, Levenshtein + phonetic identities blocked by DOB.
   Family hubs and public hubs (CSC IPs, colleges) are discounted.
2. **Money** (`money.py`): collector fan-in within 24 h of payout and bounded cycle detection (kickbacks).
3. **Graph** (`graph.py`): inverse-frequency weighted record graph, connected components, Louvain.
4. **Rings** (`rings.py`): explainable risk index (weighted signal coverage, family discount), priority.
5. **Lone** (`lone.py`): rules combined with noisy-OR, Isolation Forest boost, PCA scatter.
6. **Explain** (`explain.py`): red-cell anomalies, reasons, record features.

## Workflow
- Never push to `main`. Branch with your prefix (`a/`, `b/`, `c/`, `be/`), open a PR, a teammate reviews.
- Small, frequent commits. API changes go into `docs/API.md` first.
- Never commit `.env`.
