# TheOutliers

Ghost-beneficiary detection for welfare and scholarship schemes. Finds **ring ghosts** (organised groups linked by shared payout accounts, phones, agents, OTP devices, timing and money flow) and **lone ghosts** (single suspicious records), and explains every flag.

## Structure
- `frontend/`: React + Vite. Pages: Landing, Ring threats, Lone threats, Dataset & method.
- `backend/`: Express API. Serves realistic **mock data** by default, or real results from the ML service.
- `ml/`: FastAPI service running the detection pipeline.
- `docs/API.md`: API contract (frontend ↔ Express ↔ ML). **Read this first.**
- `docs/TASKS.md`: who builds what.

## Run (mock mode, no ML needed)
```bash
cd backend && npm install && copy .env.example .env && cd ..
cd frontend && npm install && cd ..
npm --prefix backend run dev
npm --prefix frontend run dev
```
Open http://localhost:5173. API health: http://localhost:5000/api/health.

## Run with the ML service
```bash
cd ml
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
Then set `MOCK=false` in `backend/.env` and restart the backend.

## Workflow
- Never push to `main`. Branch with your prefix (`a/`, `b/`, `c/`, `be/`), open a PR, a teammate reviews.
- Small, frequent commits. API changes go into `docs/API.md` first.
- Never commit `.env`.
