# API Contracts (v3)

Single source of truth for **Frontend <-> Express** and **Express <-> ML (FastAPI)**.

**Change rule:** need a new field or endpoint? Ask the backend owner. Update this file first, announce it in the group chat, then code. Log it in the change table at the bottom.

**Product:** detect **ring ghosts** (organised groups of fake or diverted beneficiaries linked by shared bank accounts / UPI IDs, biometrics, registration IPs, batch phones, templated emails, addresses, name variants and money cycles) and **lone ghosts** (single suspicious records found by behaviour). The dataset is pre-loaded, so there is no upload flow and no login.

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
- **IDs:** rings `R-001`, records `B-000123`. Hub nodes are `<TYPE>-<6 hex>`, e.g. `ACC-3f9a1c`, `UPI-…`, `BIO-…`, `IP-…`, `PHO-…`, `EMA-…`, `ADD-…`.
- **Dates:** ISO 8601 UTC strings, e.g. `2026-09-27T10:15:00Z`.
- **Money:** integers in INR. Field names end in `Inr`.
- **Risk:** `riskScore` integer 0-100. `riskLevel`: `"low"` (<40), `"medium"` (40-69), `"high"` (70-100).
- **Masking:** phones `6295XXXX81` (first 4 + last 2), Aadhaar `XXXX XXXX 6266`, bank accounts `SBI ****8341`, biometric hash first 10 chars. Never raw Aadhaar or full account numbers.
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
{ "signal": "sharedAccount", "label": "8 members pay out to one shared bank account", "weight": 0.31 }
```
`weight` = share of the score, 0-1.

**Signal values**

| Signal | Kind | Red cell on field | Meaning |
|---|---|---|---|
| `sharedAccount` | ring | `bankAccount` | Same bank account as other members |
| `sharedUpi` | ring | `upiId` | Same UPI ID as other members |
| `sharedBiometric` | ring | `biometricHash` | Same biometric under different names |
| `sharedIp` | ring | `registrationIp` | Registered from the same IP |
| `registrationBurst` | ring | `registrationAt` | 3+ registrations from one IP within an hour |
| `batchPhone` | ring | `phoneMasked` | Near-sequential phone numbers |
| `sharedPhone` | ring | `phoneMasked` | Exactly the same phone |
| `templatedEmail` | ring | `email` | `user326@`, `user327@` … on a disposable domain |
| `sharedAddress` | ring | `address` | Same address (spelling variants normalised) |
| `similarName` | ring | `name` | Near-duplicate name (Levenshtein + phonetic) |
| `sameDobFather` | ring | `dob`, `fatherName` | Same DOB and father as other members |
| `collectorAccount` | ring | `bankAccount` | Forwarded most of the payout to a collector account |
| `kickbackCycle` | ring | `bankAccount` | Money came back from the collector's agents (cycle) |
| `invalidAadhaar` | lone | `aadhaarMasked` | Fails Verhoeff checksum / format |
| `expiredAadhaar` | lone | `aadhaarStatus` | Aadhaar expired or deactivated |
| `invalidPhone` | lone | `phoneMasked` | Not a valid Indian mobile number |
| `duplicatePhone` | lone | `phoneMasked` | Phone used by an unrelated record |
| `loginBruteforce` | lone | `loginFailed` | Many failed logins quickly, then success |
| `oddHourRegistration` | lone (weak) | `registrationAt` | Registered between midnight and 6 am |

**Anomaly** (one red cell in a table: which column of which record is suspicious)
```json
{ "field": "bankAccount", "signal": "sharedAccount", "label": "Same bank account as 7 other members" }
```
`field` matches a column `key`. A record can have zero, one or many anomalies. **Render every cell whose column key appears in `anomalies` in red, with `label` as its tooltip.**

**Column** (tables are driven by the API, so new columns need no frontend change)
```json
{ "key": "bankAccount", "label": "Bank account", "type": "text", "default": true }
```
`type`: `text`, `number`, `inr`, `datetime`, `boolean`, `risk`. `default: false` columns are hidden until the user opens "More columns".

**Record row** (one row in a member table or the lone table)
```json
{
  "recordId": "B-000123",
  "fields": {
    "name": "Sonam Jha", "fatherName": "Bhola Jha", "spouseName": null, "gender": "F", "dob": "2004-03-24", "age": 21,
    "aadhaarMasked": "XXXX XXXX 6266", "aadhaarStatus": "active", "biometricHash": "8ab4798411",
    "phoneMasked": "6295XXXX81", "email": "user327@mail7.in",
    "address": "House 30, Ward 6, Islampur", "district": "Nalanda", "state": "Bihar", "pincode": "803171",
    "registrationIp": "117.99.30.186", "registrationChannel": "self",
    "registrationAt": "2025-08-13T17:35:38Z", "appliedAt": "2025-08-13T17:52:38Z",
    "bankAccount": "SBI ****8341", "ifsc": "SBIN0841692", "upiId": null, "payoutMode": "DBT_BANK",
    "amountInr": 36000, "payoutAt": "2025-09-15T09:00:00Z",
    "loginFailed": 0, "loginWindowMinutes": 2, "riskScore": 91
  },
  "anomalies": [
    { "field": "registrationIp", "signal": "sharedIp", "label": "Same registration IP as 9 other members" },
    { "field": "registrationAt", "signal": "registrationBurst", "label": "Registered within the same hour as 9 other members from one IP" },
    { "field": "phoneMasked", "signal": "batchPhone", "label": "Phone number in a sequence with 6 other members" }
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
`type`: `beneficiary`, `account` (incl. collector and agent accounts), `upi`, `biometric`, `ip`, `phone`, `email`, `address`. Non-beneficiary nodes are the shared "hub" items. `ringId` is `null` for background context nodes.

**GraphEdge**
```json
{ "source": "B-000123", "target": "ACC-3f9a1c", "type": "sharedAccount", "weight": 1.0 }
{ "source": "B-000123", "target": "ACC-77b2e0", "type": "transfer", "weight": 1.0, "amountInr": 30600 }
```
`type` is a ring signal, or `transfer` for money movement (directed source -> target, with `amountInr`). Draw transfer edges with arrows or moving particles: collector fan-in and agent -> member edges show the kickback cycle.

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
  "recordsScanned": 20000,
  "transfersScanned": 17667,
  "auditDurationSeconds": 4.2,
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
`auditDurationSeconds` may be `null` (mock mode); when present show records/second (the "high-throughput" claim). Counts exclude anything `deflagged`. `ringsFound` counts rings with `riskScore >= 40` (low-risk rings stay visible on the Ring page but are not counted).

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
    { "id": "ACC-3f9a1c", "type": "account", "label": "SBI ****4521", "ringId": "R-001", "riskScore": 91, "status": "flagged" },
    { "id": "B-002201", "type": "beneficiary", "label": "Meena Kumari", "ringId": null, "riskScore": 4, "status": "notFlagged" }
  ],
  "edges": [
    { "source": "B-000123", "target": "ACC-3f9a1c", "type": "sharedAccount", "weight": 1.0 }
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
        { "signal": "registrationBurst", "label": "10 members registered within one hour from one IP", "weight": 0.22 },
        { "signal": "collectorAccount", "label": "7 members forwarded most of their payout to one collector", "weight": 0.18 }
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
  "summary": "14 beneficiaries in Nalanda with different names and Aadhaar numbers are linked: 8 members pay out to one shared bank account; 10 registered within one hour from one IP. ₹12.6 lakh is at risk.",
  "reasons": [
    { "signal": "sharedAccount", "label": "14 beneficiaries pay out to 2 bank accounts", "weight": 0.34 }
  ],
  "signalBreakdown": [
    { "signal": "sharedAccount", "label": "Shared payout account", "value": 0.92 },
    { "signal": "registrationBurst", "label": "Registration burst", "value": 0.71 },
    { "signal": "sharedIp", "label": "Same registration IP", "value": 0.71 }
  ],
  "columns": [
    { "key": "name", "label": "Name", "type": "text", "default": true },
    { "key": "bankAccount", "label": "Bank account", "type": "text", "default": true },
    { "key": "ifsc", "label": "IFSC", "type": "text", "default": false }
  ],
  "members": [ { "recordId": "B-000123", "fields": { "…": "see Record row" }, "anomalies": [], "riskScore": 91, "riskLevel": "high", "status": "flagged", "manualOverride": false, "note": null } ],
  "sharedEntities": [
    { "id": "ACC-3f9a1c", "type": "account", "label": "SBI ****4521", "linkedMembers": 9 },
    { "id": "IP-91c2aa", "type": "ip", "label": "117.99.30.186", "linkedMembers": 10 }
  ],
  "graph": { "nodes": [], "edges": [] },
  "timeline": [
    { "at": "2025-08-13T17:35:38Z", "event": "registration", "recordId": "B-000123" },
    { "at": "2025-09-15T09:00:00Z", "event": "payout", "recordId": "B-000123", "amountInr": 36000 },
    { "at": "2025-09-15T09:35:00Z", "event": "transfer", "recordId": "B-000123", "amountInr": 30600, "to": "Ext ****1250" }
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
    { "heading": "Recommended action", "body": "Hold payouts to and freeze SBI ****8341. Trace who registered from IP 117.99.30.186." }
  ],
  "markdown": "# Case brief: Ring R-001 ..."
}
```
`generatedBy`: `template` or `llm`. May take a few seconds when an LLM is used, so show a spinner.

#### GET /api/stress-test/scenarios (star feature)
```json
{
  "scenarios": [
    { "id": "freshAccounts", "label": "Ring opens a fresh bank account and UPI ID per member", "description": "Removes shared-account and shared-UPI signals." },
    { "id": "spreadOut", "label": "Ring registers from different IPs over weeks", "description": "Removes shared-IP and burst signals." },
    { "id": "freshContacts", "label": "Ring buys unrelated SIMs and real-looking emails", "description": "Removes batch-phone, shared-phone and templated-email signals." },
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
  "adapted":   { "ringsDetected": 6,  "recall": 0.38, "lostSignals": ["sharedAccount", "sharedUpi"] },
  "recovered": { "ringsDetected": 11, "recall": 0.69, "signalsUsed": ["sharedBiometric", "collectorAccount", "registrationBurst"] },
  "rings": [
    { "ringId": "R-001", "before": 91, "adapted": 52, "recovered": 78, "detectedAfter": true }
  ],
  "takeaway": "Adapting drops detection from 14 to 6 rings; the remaining signals (sharedBiometric, collectorAccount, registrationBurst) recover 11."
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
    { "recordId": "B-004211", "x": 0.86, "y": 0.14, "riskScore": 78, "riskLevel": "high", "flagged": true, "status": "flagged", "topSignal": "loginBruteforce" },
    { "recordId": "B-000045", "x": 0.41, "y": 0.52, "riskScore": 6, "riskLevel": "low", "flagged": false, "status": "notFlagged", "topSignal": null }
  ],
  "axes": { "x": "Behaviour projection 1", "y": "Behaviour projection 2" }
}
```
x and y are normalised 0-1 (in mock mode the angle groups points by top signal). Flagged points: large, glowing red. Normal: small, faint. Selected: brighten, dim the rest.

#### GET /api/lone
Ranked list / table of lone ghosts.
Query: `minRisk`, `level`, `status` (comma list, default all: `flagged,confirmed,deflagged`), `district`, `signal` (only records with this anomaly signal), `sort` (`riskScore` default, `amountInr`), `order`, `page`, `pageSize`.
```json
{
  "columns": [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "items": [
    {
      "recordId": "B-004211",
      "fields": { "name": "Asha Devi", "district": "Gaya", "aadhaarMasked": "XXXX XXXX 0417", "aadhaarStatus": "active", "loginFailed": 11, "loginWindowMinutes": 9, "registrationAt": "2025-08-02T01:53:10Z", "amountInr": 25000, "riskScore": 78 },
      "anomalies": [
        { "field": "aadhaarMasked", "signal": "invalidAadhaar", "label": "Aadhaar number fails the Verhoeff checksum or format check" },
        { "field": "loginFailed", "signal": "loginBruteforce", "label": "11 failed logins in 9 min, then success" },
        { "field": "registrationAt", "signal": "oddHourRegistration", "label": "Registered at 01:53 at night" }
      ],
      "topReasons": [
        { "signal": "invalidAadhaar", "label": "Aadhaar number fails the Verhoeff checksum or format check", "weight": 0.3 }
      ],
      "riskScore": 78, "riskLevel": "high", "status": "flagged", "manualOverride": false, "note": null
    }
  ],
  "page": 1, "pageSize": 20, "total": 120
}
```
Items use the **Record row** shape plus `topReasons`. Records flagged manually by a human also appear here with `manualOverride: true`. Expect some genuine people here (a mistyped phone or Aadhaar): that is what deflag is for.

#### GET /api/records/:recordId
Full detail for **any** record (lone point, ring member, or unflagged record). Used by the Lone detail panel and by "View full record" in the Ring member table.
```json
{
  "recordId": "B-004211",
  "fields": { "…": "all fields, see Record row" },
  "anomalies": [],
  "columns": [ { "key": "name", "label": "Name", "type": "text", "default": true } ],
  "reasons": [ { "signal": "loginBruteforce", "label": "11 failed logins in 9 min, then success", "weight": 0.28 } ],
  "features": [
    { "key": "loginFailed", "label": "Failed logins before success", "value": 11, "typical": 0, "anomalous": true },
    { "key": "loginWindowMinutes", "label": "Login window (minutes)", "value": 9, "typical": 3, "anomalous": true },
    { "key": "phoneSharedWith", "label": "Other records with this phone", "value": 0, "typical": 0, "anomalous": false },
    { "key": "accountSharedWith", "label": "Other records paid to this account", "value": 0, "typical": 0, "anomalous": false },
    { "key": "ipSharedWith", "label": "Other records registered from this IP", "value": 0, "typical": 0, "anomalous": false },
    { "key": "registrationHour", "label": "Hour of registration (UTC)", "value": 1, "typical": 14, "anomalous": true }
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
  "recordCount": 20000,
  "transferCount": 17667,
  "generatedAt": "2026-09-26T18:00:00Z",
  "description": "Synthetic welfare ledger. Names, addresses and phones follow realistic Indian distributions. Fraud was planted afterwards with known labels.",
  "columnGroups": [
    {
      "group": "Identity",
      "columns": [ { "name": "full_name, father_name, spouse_name", "usedFor": ["ring"], "description": "Levenshtein + phonetic matching for name variants" } ]
    }
  ],
  "planted": {
    "rings": 31,
    "ringTypes": [ { "type": "kickback_cycle", "count": 3, "heldOut": false, "description": "Members forward 60-90% of payouts to a collector; agents pay commissions back" } ],
    "loneGhosts": 240,
    "loneTraits": { "invalid_aadhaar": 70, "expired_aadhaar": 69 },
    "hardNegatives": [ { "type": "twins", "count": 444, "description": "Twins: same DOB, father and address, often rhyming names" } ]
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
  "notes": "Headline numbers are from the held-out test set...",
  "ranAt": "2026-09-27T08:00:00Z",
  "testSet": {
    "rings": { "planted": 35, "found": 35, "falseAlerts": 1, "precision": 0.97, "recall": 1.0, "f1": 0.99 },
    "ringMembers": { "precision": 0.95, "recall": 0.94, "f1": 0.94 },
    "lone": { "planted": 200, "found": 178, "falseAlerts": 13, "precision": 0.93, "recall": 0.89, "f1": 0.91 },
    "byRingType": [ { "type": "slow_drip", "planted": 4, "found": 4, "heldOut": true } ],
    "throughput": { "records": 20000, "transfers": 17536, "seconds": 3.5, "recordsPerSecond": 5714 }
  },
  "devSet": { "…": "same shape as testSet (the tuning set)" },
  "scaleRun": { "records": 200000, "transfers": 176497, "seconds": 52.6, "recordsPerSecond": 3802 }
}
```
`simulatedLedger` = the held-out **test** set numbers (headline). `public` may be an empty array. In `public`, `f1` may be `null` (IBM AML reports pattern recall and flag precision separately), and optional `liftOverRandom`, `patterns`, `found`, `note` may appear. `devSet`, `testSet` and `scaleRun` are optional; when present show `byRingType` (held-out types marked) and `scaleRun.recordsPerSecond` on the Dataset & Method page.

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
  "oracle": false,
  "finishedAt": "2026-09-27T02:01:12Z",
  "datasetName": "Post-Matric Scholarship 2025-26 (simulated)",
  "recordsScanned": 20000,
  "transfersScanned": 17667,
  "auditDurationSeconds": 4.2,
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

- `MOCK=true` in `backend/.env` (default): Express serves `backend/src/mock/bundle.json` plus the real `ml/data/ledger.csv`. The bundle is an **oracle** built from the ground truth by `ml/data/build_mock_bundle.py` (`"oracle": true`): real rows, perfect labels. For UI work only, never for metrics.
- `MOCK=false`: Express pulls the bundle from ML (`ML_URL`). Same responses, real data.

---

## 5. Change log

| Date | Endpoint | Change | By |
|---|---|---|---|
| 2026-09-27 | all | v1 created | backend |
| 2026-10-09 | all | v2: red anomaly cells (`anomalies`, `columns`), member deflag, ring colours, baseline, priority, case brief, stress test, single ML bundle | backend |
| 2026-10-09 | /api/benchmarks | optional `testSet`, `devSet` (with `ringMembers`, `byRingType`, `throughput`) and `scaleRun` | backend |
| 2026-10-09 | all | v3: field keys and signals match the final dataset (Aadhaar, biometric, IP, UPI, email, login, transfers); `transfer` edges; new record features; stress scenario ids; `transfersScanned`, `auditDurationSeconds`, `oracle` | backend |
