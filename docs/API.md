# API Contracts (v2)

Single source of truth for **Frontend <-> Express** and **Express <-> ML (FastAPI)**.

**Change rule:** need a new field or endpoint? Ask the backend owner. Update this file first, announce it in the group chat, then code. Log it in the change table at the bottom.

**Product:** detect **ring ghosts** (organised groups of fake or diverted beneficiaries linked by shared payout accounts, phones, agents, OTP devices, timing and money flow) and **lone ghosts** (single suspicious records found by behaviour). The dataset is pre-loaded, so there is no upload flow and no login.

---

## 0. Pages -> endpoints

| Page | Owner | Endpoints |
|---|---|---|
| Landing (`/`) | Dashboard | `GET /api/overview`, `GET /api/baseline` |
| Dataset & Method (`/dataset`) | Dashboard | `GET /api/dataset`, `GET /api/benchmarks` |
| Ring Threats (`/rings`) | Ring | `GET /api/rings/graph`, `GET /api/rings`, `GET /api/rings/:ringId`, `PUT`/`DELETE /api/rings/:ringId/status`, `PUT`/`DELETE /api/records/:recordId/status`, `GET /api/records/:recordId`, `POST /api/rings/:ringId/brief`, `GET /api/baseline`, `GET /api/stress-test/scenarios`, `POST /api/stress-test` |
| Lone Threats (`/lone`) | Lone | `GET /api/lone/points`, `GET /api/lone`, `GET /api/records/:recordId`, `GET /api/records/search`, `PUT`/`DELETE /api/records/:recordId/status` |

All frontend calls already exist as functions in `frontend/src/api/client.js`. Use those, do not call `fetch` directly.

---

## 1. Conventions (every endpoint)

- **Base URLs:** Express `http://localhost:5000/api`. ML `http://localhost:8000` (only Express calls ML). In the frontend, call relative `/api/...`; Vite proxies it to Express.
- **Format:** JSON, **camelCase** keys.
- **IDs:** rings `R-001`, records `B-000123`, accounts `A-0045`, phones `P-0099`, agents `AG-07`, devices `D-0312`, addresses `AD-0021`.
- **Dates:** ISO 8601 UTC strings, e.g. `2026-09-27T10:15:00Z`.
- **Money:** integers in INR. Field names end in `Inr`.
- **Risk:** `riskScore` integer 0-100. `riskLevel`: `"low"` (<40), `"medium"` (40-69), `"high"` (70-100).
- **Masking:** phones masked (`98XXXXXX21`), Aadhaar only as `aadhaarHash`. Never raw Aadhaar.
- **Pagination:** `?page=1&pageSize=20` (default 1 / 20, max 100). Response: `{ "items": [], "page": 1, "pageSize": 20, "total": 134 }`.
- **Sorting:** `?sort=<field>&order=desc|asc`.
- **Status** (`status`) for rings and records:
  - `"flagged"`: flagged by the system, not reviewed yet
  - `"confirmed"`: a human confirmed it as fraud
  - `"deflagged"`: a human marked it as a false alarm (shown struck through / dimmed, excluded from counts)
  - `"notFlagged"`: the system did not flag it (records only)
- **`manualOverride`:** `true` when a human changed the system's decision.
- **Errors** (HTTP 4xx/5xx):
  ```json
  { "error": { "code": "NOT_FOUND", "message": "Ring R-999 does not exist" } }
  ```
  Codes: `BAD_REQUEST` 400, `NOT_FOUND` 404, `ML_UNAVAILABLE` 502, `INTERNAL` 500.

### 1.1 Shared shapes

**Reason** (why something was flagged; UI shows the top 3 as chips)
```json
{ "signal": "sharedAccount", "label": "11 beneficiaries pay out to 2 bank accounts", "weight": 0.31 }
```
`weight` = share of the score, 0-1.

**Signal values:** `sharedAccount`, `sharedPhone`, `sharedAddress`, `similarName`, `sharedDevice`, `sharedAgent`, `timingBurst`, `moneyFlowCycle`, `collectorAccount`, `newAccount`, `instantWithdrawal`, `templatedId`, `oddHourApplication`, `areaAnomaly`, `registryMismatch`.

**Anomaly** (one red cell in a table: which column of which record is suspicious)
```json
{ "field": "payoutAccount", "signal": "sharedAccount", "label": "Same account as 8 other members" }
```
`field` matches a column `key`. A record can have zero, one or many anomalies. **Render every cell whose column key appears in `anomalies` in red, with `label` as its tooltip.**

**Column** (tables are driven by the API, so new columns need no frontend change)
```json
{ "key": "payoutAccount", "label": "Payout account", "type": "text", "default": true }
```
`type`: `text`, `number`, `inr`, `datetime`, `boolean`, `risk`. `default: false` columns are hidden until the user opens "More columns".

**Record row** (one row in a member table or the lone table)
```json
{
  "recordId": "B-000123",
  "fields": {
    "name": "Rajesh Kumar", "age": 20, "gender": "M", "phoneMasked": "98XXXXXX21",
    "address": "Ward 4, Rajgir", "district": "Nalanda", "pincode": "803116",
    "aadhaarHash": "a91f…3c", "payoutAccount": "SBI ****4521", "ifsc": "SBIN0004521",
    "agentId": "AG-07", "deviceId": "D-0312", "otpIp": "10.4.2.17",
    "accountOpenedAt": "2025-08-10T00:00:00Z", "appliedAt": "2025-08-14T10:02:00Z",
    "payoutAt": "2025-08-20T09:00:00Z", "amountInr": 90000, "minutesToWithdrawal": 7,
    "enrolledInRegistry": true, "riskScore": 91
  },
  "anomalies": [
    { "field": "payoutAccount", "signal": "sharedAccount", "label": "Same account as 8 other members" },
    { "field": "agentId", "signal": "sharedAgent", "label": "Agent filed all 14 applications" }
  ],
  "riskScore": 91,
  "riskLevel": "high",
  "status": "flagged",
  "manualOverride": false,
  "note": null
}
```

**GraphNode**
```json
{ "id": "B-000123", "type": "beneficiary", "label": "Rajesh Kumar", "ringId": "R-001", "riskScore": 91, "status": "flagged" }
```
`type`: `beneficiary`, `account`, `phone`, `agent`, `device`, `address`. Non-beneficiary nodes are the shared "hub" items. `ringId` is `null` for background context nodes.

**GraphEdge**
```json
{ "source": "B-000123", "target": "A-0045", "type": "sharedAccount", "weight": 1.0 }
```

---

## 2. Frontend <-> Express

### 2.1 General

#### GET /api/health
```json
{ "status": "ok", "mode": "mock", "ml": "down", "time": "2026-09-27T10:15:00Z" }
```
`mode`: `mock` (Express serves generated mock data) or `live` (data from ML). `ml`: `ok` or `down`.

#### GET /api/overview
Landing page numbers.
```json
{
  "datasetName": "Post-Matric Scholarship 2025-26 (simulated)",
  "recordsScanned": 48000,
  "ringsFound": 14,
  "ringMembers": 212,
  "loneGhostsFound": 120,
  "totalAtRiskInr": 32000000,
  "ringAtRiskInr": 25400000,
  "loneAtRiskInr": 6600000,
  "reviewed": { "confirmed": 3, "deflagged": 1 },
  "lastAuditAt": "2026-09-27T02:00:00Z"
}
```
Counts exclude anything `deflagged`. `ringsFound` counts rings with `riskScore >= 40` (low-risk rings stay visible on the Ring page but are not counted).

#### GET /api/baseline
"Unique-ID check vs. our system" comparison. Used on Landing (comparison strip) and Ring page (toggle).
```json
{
  "baseline": {
    "method": "Unique Aadhaar / ID check",
    "recordsFlagged": 6,
    "ringsDetected": 0,
    "amountCaughtInr": 270000,
    "flaggedRecordIds": ["B-000881", "B-000882"]
  },
  "ours": {
    "method": "Graph linkage + behaviour scoring",
    "recordsFlagged": 332,
    "ringsDetected": 14,
    "amountCaughtInr": 32000000
  },
  "planted": { "rings": 16, "loneGhosts": 130 },
  "headline": "The unique-ID check catches 0 of 14 rings. Our graph catches all 14."
}
```
`planted` is present only because the data is simulated with known labels.

---

### 2.2 Ring Threats

#### GET /api/rings/graph
Everything needed for the constellation canvas.
Query: `includeContext` (`true|false`, default `true`), `contextNodes` (default 300, max 2000), `minRisk` (default 0), `status` (comma list, default `flagged,confirmed`).
```json
{
  "nodes": [
    { "id": "B-000123", "type": "beneficiary", "label": "Rajesh Kumar", "ringId": "R-001", "riskScore": 91, "status": "flagged" },
    { "id": "A-0045", "type": "account", "label": "SBI ****4521", "ringId": "R-001", "riskScore": 91, "status": "flagged" },
    { "id": "B-002201", "type": "beneficiary", "label": "Meena Kumari", "ringId": null, "riskScore": 4, "status": "notFlagged" }
  ],
  "edges": [
    { "source": "B-000123", "target": "A-0045", "type": "sharedAccount", "weight": 1.0 }
  ],
  "rings": [
    { "ringId": "R-001", "color": "#FF3B3B", "riskScore": 91, "riskLevel": "high", "memberCount": 14, "status": "flagged" }
  ]
}
```
- Colour each node by its ring's `color`. Nodes with `ringId: null` are faint grey background stars.
- Selecting a ring is client-side: brighten nodes with that `ringId`, dim the rest. No extra call.
- Deflagged members come back with `status: "deflagged"`; draw them hollow/grey.

#### GET /api/rings
Ranked ring list.
Query: `minRisk`, `level` (`low|medium|high`), `status` (comma list, default all: `flagged,confirmed,deflagged` so deflagged rings can be undone), `district`, `sort` (`riskScore` default, `priorityScore`, `amountAtRiskInr`, `memberCount`), `order`, `page`, `pageSize`.
```json
{
  "items": [
    {
      "ringId": "R-001",
      "color": "#FF3B3B",
      "riskScore": 91,
      "riskLevel": "high",
      "memberCount": 14,
      "activeMemberCount": 13,
      "amountAtRiskInr": 1260000,
      "district": "Nalanda",
      "ringType": "sharedAccount",
      "status": "flagged",
      "manualOverride": false,
      "priority": { "priorityScore": 88, "rank": 1, "recoverableInr": 1170000, "effort": "low" },
      "topReasons": [
        { "signal": "sharedAccount", "label": "14 beneficiaries pay out to 2 bank accounts", "weight": 0.34 },
        { "signal": "timingBurst", "label": "All applied within 40 minutes", "weight": 0.22 },
        { "signal": "sharedAgent", "label": "Agent AG-07 filed all applications", "weight": 0.18 }
      ]
    }
  ],
  "page": 1, "pageSize": 20, "total": 14
}
```
- `activeMemberCount` excludes deflagged members. `amountAtRiskInr` counts active members only.
- `priority.effort`: `low|medium|high` (how hard to investigate). `rank` 1 = investigate first. **"Prioritise" button = `sort=priorityScore`.**

#### GET /api/rings/:ringId
Everything for the selected ring's detail panel and member table.
```json
{
  "ringId": "R-001",
  "color": "#FF3B3B",
  "riskScore": 91,
  "riskLevel": "high",
  "status": "flagged",
  "manualOverride": false,
  "note": null,
  "district": "Nalanda",
  "ringType": "sharedAccount",
  "memberCount": 14,
  "activeMemberCount": 13,
  "amountAtRiskInr": 1260000,
  "priority": { "priorityScore": 88, "rank": 1, "recoverableInr": 1170000, "effort": "low" },
  "summary": "14 beneficiaries with different names and Aadhaar IDs receive payouts into two shared bank accounts. Agent AG-07 filed all applications within 40 minutes.",
  "reasons": [
    { "signal": "sharedAccount", "label": "14 beneficiaries pay out to 2 bank accounts", "weight": 0.34 }
  ],
  "signalBreakdown": [
    { "signal": "sharedAccount", "label": "Shared payout account", "value": 0.92 },
    { "signal": "timingBurst", "label": "Application burst", "value": 0.88 },
    { "signal": "sharedAgent", "label": "Same agent", "value": 0.81 }
  ],
  "columns": [
    { "key": "name", "label": "Name", "type": "text", "default": true },
    { "key": "payoutAccount", "label": "Payout account", "type": "text", "default": true },
    { "key": "ifsc", "label": "IFSC", "type": "text", "default": false }
  ],
  "members": [ { "recordId": "B-000123", "fields": { "…": "see Record row" }, "anomalies": [], "riskScore": 91, "riskLevel": "high", "status": "flagged", "manualOverride": false, "note": null } ],
  "sharedEntities": [
    { "id": "A-0045", "type": "account", "label": "SBI ****4521", "linkedMembers": 9 },
    { "id": "AG-07", "type": "agent", "label": "Agent AG-07", "linkedMembers": 14 }
  ],
  "graph": { "nodes": [], "edges": [] },
  "timeline": [
    { "at": "2025-08-14T10:02:00Z", "event": "application", "recordId": "B-000123" },
    { "at": "2025-08-20T09:00:00Z", "event": "payout", "recordId": "B-000123", "amountInr": 90000 },
    { "at": "2025-08-20T09:07:00Z", "event": "withdrawal", "recordId": "B-000123", "amountInr": 90000 }
  ]
}
```
- `members[]` uses the **Record row** shape. Render as a table using `columns` (default ones first, the rest behind "More columns"), red cells from `anomalies`.
- `members[].fields.riskScore` is also in `fields` so it can be a column.

#### PUT /api/rings/:ringId/status
Confirm or deflag a whole ring (manual removal of a falsely detected ring).
Request: `{ "status": "deflagged", "note": "Self-help group sharing one account" }`
`status`: `flagged`, `confirmed`, `deflagged`. `note` optional, max 500 chars.
Response:
```json
{ "ringId": "R-001", "status": "deflagged", "manualOverride": true, "note": "Self-help group sharing one account", "updatedAt": "2026-09-27T11:00:00Z" }
```

#### DELETE /api/rings/:ringId/status
Undo the manual decision. Response: `{ "ringId": "R-001", "status": "flagged", "manualOverride": false }`

**Removing one wrongly included member** uses the record endpoint: `PUT /api/records/:recordId/status` with `{ "status": "deflagged" }`. The ring's `activeMemberCount` and `amountAtRiskInr` update automatically.

#### POST /api/rings/:ringId/brief
Generate the one-page case brief for the investigating officer.
Request (optional): `{ "audience": "investigator" }`
```json
{
  "ringId": "R-001",
  "generatedAt": "2026-09-27T11:10:00Z",
  "generatedBy": "template",
  "title": "Case brief: Ring R-001 (Nalanda)",
  "sections": [
    { "heading": "Summary", "body": "14 beneficiaries ... ₹12.6 lakh at risk." },
    { "heading": "Evidence", "body": "- 9 members share account SBI ****4521\n- ..." },
    { "heading": "Members", "body": "B-000123 Rajesh Kumar, ..." },
    { "heading": "Recommended action", "body": "Freeze accounts A-0045 and A-0046 and verify agent AG-07." }
  ],
  "markdown": "# Case brief: Ring R-001 ..."
}
```
`generatedBy`: `template` or `llm`. May take a few seconds when an LLM is used, so show a spinner.

#### GET /api/stress-test/scenarios (star feature)
```json
{
  "scenarios": [
    { "id": "freshAccounts", "label": "Ring opens a fresh account per member", "description": "Removes the shared-account signal." },
    { "id": "spreadTiming", "label": "Ring spreads applications over 3 weeks", "description": "Removes the timing-burst signal." },
    { "id": "freshDevices", "label": "Ring uses a new phone/device per member", "description": "Removes device and OTP signals." },
    { "id": "allAdaptations", "label": "All of the above", "description": "Worst case." }
  ]
}
```

#### POST /api/stress-test (star feature)
Request: `{ "scenario": "freshAccounts" }`
```json
{
  "scenario": "freshAccounts",
  "before":    { "ringsDetected": 14, "recall": 0.88 },
  "adapted":   { "ringsDetected": 6,  "recall": 0.38, "lostSignals": ["sharedAccount"] },
  "recovered": { "ringsDetected": 11, "recall": 0.69, "signalsUsed": ["sharedAgent", "timingBurst", "collectorAccount"] },
  "rings": [
    { "ringId": "R-001", "before": 91, "adapted": 52, "recovered": 78, "detectedAfter": true }
  ],
  "takeaway": "Removing shared accounts drops detection to 6 rings; agent, timing and money-flow signals recover 11."
}
```

---

### 2.3 Lone Threats

#### GET /api/lone/points
Points for the sparse scatter plot (one point = one record; x/y come from a 2-D projection of behaviour features).
Query: `includeNormal` (default `true`), `normalSample` (default 600, max 3000), `minRisk`, `status`.
```json
{
  "points": [
    { "recordId": "B-004211", "x": 0.86, "y": 0.14, "riskScore": 78, "riskLevel": "high", "flagged": true, "status": "flagged", "topSignal": "instantWithdrawal" },
    { "recordId": "B-000045", "x": 0.41, "y": 0.52, "riskScore": 6, "riskLevel": "low", "flagged": false, "status": "notFlagged", "topSignal": null }
  ],
  "axes": { "x": "Behaviour projection 1", "y": "Behaviour projection 2" }
}
```
x and y are normalised 0-1. Flagged points: large, glowing red. Normal: small, faint. Selected: brighten, dim the rest.

#### GET /api/lone
Ranked list / table of lone ghosts.
Query: `minRisk`, `level`, `status` (comma list, default all: `flagged,confirmed,deflagged`), `district`, `signal` (only records with this anomaly signal), `sort` (`riskScore` default, `amountInr`), `order`, `page`, `pageSize`.
```json
{
  "columns": [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "items": [
    {
      "recordId": "B-004211",
      "fields": { "name": "Asha Devi", "district": "Gaya", "amountInr": 45000, "accountOpenedAt": "2025-08-11T00:00:00Z", "minutesToWithdrawal": 6, "riskScore": 78 },
      "anomalies": [
        { "field": "minutesToWithdrawal", "signal": "instantWithdrawal", "label": "Full amount withdrawn 6 minutes after payout" },
        { "field": "accountOpenedAt", "signal": "newAccount", "label": "Account opened 3 days before applying" }
      ],
      "topReasons": [
        { "signal": "instantWithdrawal", "label": "Full amount withdrawn 6 minutes after payout", "weight": 0.35 }
      ],
      "riskScore": 78, "riskLevel": "high", "status": "flagged", "manualOverride": false, "note": null
    }
  ],
  "page": 1, "pageSize": 20, "total": 120
}
```
Items use the **Record row** shape plus `topReasons`. Records flagged manually by a human also appear here with `manualOverride: true`.

#### GET /api/records/:recordId
Full detail for **any** record (lone point, ring member, or unflagged record). Used by the Lone detail panel and by "View full record" in the Ring member table.
```json
{
  "recordId": "B-004211",
  "fields": { "…": "all fields, see Record row" },
  "anomalies": [],
  "columns": [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "reasons": [ { "signal": "instantWithdrawal", "label": "Full amount withdrawn 6 minutes after payout", "weight": 0.35 } ],
  "features": [
    { "key": "accountAgeDays", "label": "Account age at application (days)", "value": 3, "typical": 640, "anomalous": true },
    { "key": "minutesToWithdrawal", "label": "Minutes from payout to withdrawal", "value": 6, "typical": 4300, "anomalous": true },
    { "key": "appliedHour", "label": "Hour of application", "value": 3, "typical": 14, "anomalous": true }
  ],
  "kind": "lone",
  "ringId": null,
  "riskScore": 78, "riskLevel": "high", "status": "flagged", "manualOverride": false, "note": null
}
```
`kind`: `lone`, `ringMember`, or `normal`. `ringId` set when `kind` is `ringMember`. `features[].typical` is the dataset median, for a "this vs typical" bar.

#### GET /api/records/search
Find any record to inspect or flag manually.
Query: `q` (name, record ID or last digits of phone; min 2 chars), `limit` (default 10, max 50).
```json
{
  "items": [
    { "recordId": "B-000045", "name": "Sunita Kumari", "district": "Patna", "riskScore": 6, "kind": "normal", "status": "notFlagged" }
  ]
}
```

#### PUT /api/records/:recordId/status
Manually flag, confirm or deflag one record (lone ghost, ring member, or an unflagged record).
Request: `{ "status": "flagged", "note": "Suspicious per field visit" }`
Response:
```json
{ "recordId": "B-000045", "status": "flagged", "manualOverride": true, "note": "Suspicious per field visit", "updatedAt": "2026-09-27T11:05:00Z" }
```

#### DELETE /api/records/:recordId/status
Undo. Response: `{ "recordId": "B-000045", "status": "notFlagged", "manualOverride": false }`

---

### 2.4 Dataset & Method

#### GET /api/dataset
```json
{
  "name": "Post-Matric Scholarship 2025-26 (simulated)",
  "simulated": true,
  "recordCount": 48000,
  "generatedAt": "2026-09-26T18:00:00Z",
  "description": "Synthetic welfare ledger. Names, addresses and phones follow realistic Indian distributions. Fraud was planted afterwards with known labels.",
  "columnGroups": [
    {
      "group": "Identity",
      "columns": [ { "name": "name", "usedFor": ["ring", "lone"], "description": "Applicant name (fuzzy + phonetic matching)" } ]
    }
  ],
  "planted": {
    "rings": 16,
    "ringTypes": [ { "type": "sharedAccount", "count": 5, "description": "Many identities paying out to a few accounts" } ],
    "loneGhosts": 130,
    "hardNegatives": [ { "type": "families", "count": 300, "description": "Real families sharing one address" } ]
  },
  "howCreated": [ "Generated base population from realistic name, address and pincode distributions." ],
  "pipeline": [
    { "step": "Blocking", "description": "Group records by pincode, phone prefix and name initials." },
    { "step": "Linkage", "description": "Fuzzy + phonetic name match, exact match on account, phone, device, agent." },
    { "step": "Graph", "description": "Records and shared items become nodes; shared attributes become edges." },
    { "step": "Ring discovery", "description": "Connected components, Louvain, cycle and fan-in detection, burst windows." },
    { "step": "Lone scoring", "description": "Rules + Isolation Forest over behaviour features." },
    { "step": "Explain", "description": "Top contributing signals become reasons and red table cells." }
  ],
  "limitations": [ "Real welfare fraud labels are not public, so the ledger is simulated." ]
}
```

#### GET /api/benchmarks
```json
{
  "simulatedLedger": {
    "rings": { "planted": 16, "found": 14, "falseAlerts": 1, "precision": 0.93, "recall": 0.88, "f1": 0.9 },
    "lone":  { "planted": 130, "found": 112, "falseAlerts": 8, "precision": 0.93, "recall": 0.86, "f1": 0.89 }
  },
  "public": [
    { "dataset": "Febrl", "component": "Name/address matcher", "precision": 0.95, "recall": 0.93, "f1": 0.94 }
  ],
  "notes": "Public benchmarks test components only.",
  "ranAt": "2026-09-27T08:00:00Z"
}
```
`public` may be an empty array.

---

## 3. Express <-> ML (FastAPI, `http://localhost:8000`)

Express is the only caller. ML computes the audit once and serves it. **Human decisions (flag/deflag) live only in Express** (in memory, no DB) and are merged over ML output. Express also does filtering, sorting, paging and ring colours.

Shapes below reuse section 2 shapes, **minus** `status`, `manualOverride`, `note`, `color`, `activeMemberCount` (Express adds those).

| Method & path | Purpose | Response |
|---|---|---|
| `GET /health` | Liveness | `{ "status": "ok", "auditReady": true, "auditId": "AUD-001" }` |
| `POST /audit/run` | Run pipeline. Body `{ "force": false }` | `{ "auditId": "AUD-001", "status": "running" }` (`running`, `done`, `failed`) |
| `GET /audit/{auditId}` | Job status | `{ "auditId", "status", "startedAt", "finishedAt", "recordsScanned" }` |
| `GET /audit/{auditId}/result` | **Whole audit bundle** (see below). Express fetches once and caches. | Bundle |
| `GET /audit/{auditId}/records/{recordId}` | Any record | Same as `GET /api/records/:recordId` |
| `GET /audit/{auditId}/records/search?q=&limit=` | Search | Same as `GET /api/records/search` |
| `POST /audit/{auditId}/rings/{ringId}/brief` | Case brief (template or LLM) | Same as `POST /api/rings/:ringId/brief` |
| `GET /stress-test/scenarios` | Scenario list | Same as Express |
| `POST /audit/{auditId}/stress-test` | Body `{ "scenario": "freshAccounts" }` | Same as Express |
| `GET /dataset/info` | Dataset card | Same as `GET /api/dataset` |
| `GET /benchmarks` | Benchmarks | Same as `GET /api/benchmarks` |

### Audit bundle (`GET /audit/{auditId}/result`)
```json
{
  "auditId": "AUD-001",
  "finishedAt": "2026-09-27T02:01:12Z",
  "datasetName": "Post-Matric Scholarship 2025-26 (simulated)",
  "recordsScanned": 48000,
  "memberColumns": [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "loneColumns":   [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "rings": [ { "…": "GET /api/rings/:ringId shape, without Express-added fields" } ],
  "contextNodes": [ { "id": "B-002201", "type": "beneficiary", "label": "Meena Kumari", "ringId": null, "riskScore": 4 } ],
  "lone": [ { "…": "GET /api/lone item shape, without Express-added fields" } ],
  "points": [ { "…": "GET /api/lone/points point, without status" } ],
  "baseline": { "…": "GET /api/baseline shape" }
}
```
Each ring in `rings[]` carries its own `graph` (nodes + edges). Express unions them for `/api/rings/graph`.

ML errors use the same error shape. Express maps any ML failure to `502 ML_UNAVAILABLE`.

---

## 4. Modes

- `MOCK=true` in `backend/.env` (default): Express generates realistic mock data in memory (`backend/src/mock/generate.js`) with the exact shapes above. Frontend can build everything against it.
- `MOCK=false`: Express pulls the bundle from ML (`ML_URL`). Same responses, real data.

---

## 5. Change log

| Date | Endpoint | Change | By |
|---|---|---|---|
| 2026-09-27 | all | v1 created | backend |
| 2026-10-09 | all | v2: red anomaly cells (`anomalies`, `columns`), member deflag, ring colours, baseline, priority, case brief, stress test, single ML bundle | backend |
