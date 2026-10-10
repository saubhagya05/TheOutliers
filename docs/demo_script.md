# Demo script (about 6 minutes)

**Format:** each step = **DO** (what to click) and **SAY** (what to tell the judges). Say the bold lines; the rest is optional detail if they look interested. Numbers below are what the live app shows on our dataset.

---

## Before the judges arrive (10 minutes earlier)

1. Start the three services, ML first (it needs about 10 seconds to finish its audit):
   - `cd ml` then `python -m uvicorn app:app --port 8000`
   - `cd backend` then `npm run dev` (with `MOCK=false` in `backend/.env`)
   - `cd frontend` then `npm run dev`
2. Check http://localhost:5000/api/health shows `"mode":"live","ml":"ok"`.
3. **Reset state:** restart the backend (clears old Confirm/Deflag clicks) and open http://localhost:5173 in a **fresh incognito window** (so the dataset choice is asked again).
4. Browser zoom 90% if the projector is small. Close other tabs. Turn off notifications.
5. Click through once: Use our dataset → Ring threats, wait for the constellation to settle. Then reload so the judges see it fresh.
6. Have the **backup video** and the slide deck open in another window.

---

## 1. Hook (20 s): Landing page

**DO:** Landing page on screen.

**SAY:** "Scholarship schemes lose money to ghost beneficiaries: fake or diverted records that pass a simple unique-ID check. One ghost looks normal. A ring of them doesn't, because they share something that is expensive to fake: a bank account, a phone batch, a registration IP, a biometric, or the money trail itself. **We find the rings, explain every flag, and leave the final call to a human.**"

## 2. Choose the data (20 s)

**DO:** Point at the dataset strip. Click **Use our dataset →**.

**SAY:** "Real fraud labels are private, so we built a realistic scholarship ledger: **20,000 students, 33 attributes each, 17,667 money transfers**, with fraud planted where we know the answers. A government user would upload their own CSV here; we'll show that at the end."

## 3. Choose an analysis (10 s)

**DO:** On "Choose an analysis", click **Analyze Ring Threats**.

**SAY:** "Two kinds of ghosts: organised **rings**, and **lone** ghosts. Rings first, they're where the money is."

## 4. Ring threats (about 2.5 min), the core of the demo

### 4a. The constellation (20 s)
**DO:** Wait 2 to 3 seconds for the graph to settle. Sweep the cursor across the coloured clusters.

**SAY:** "Every coloured cluster is a fraud ring the pipeline found on its own. Grey dots are ordinary students. **35 rings, ₹1.16 crore at risk**, and a unique-ID check finds **zero** of them."

### 4c. Open a ring (40 s)
**DO:** Click the top card **R-001** (or its cluster). It zooms in: teal members, red warning triangles for the shared items.

**SAY:** "R-001: 13 students in Muzaffarpur, different names, different Aadhaar numbers. But **12 registered within one hour from the same IP, their phone numbers are near-sequential, and 11 use the same email template.** ₹3.9 lakh at risk."

**DO:** Scroll the right panel: signal breakdown bars, shared entities, timeline.

**SAY:** "The score is explainable: each bar is a signal and how many members carry it. Hard-to-fake signals, like a biometric or a money trail, weigh more."

### 4d. Red cells (20 s)
**DO:** Scroll to **Members**. Hover a red cell in the **Phone** or **Email** column (tooltip shows the reason). Avoid the Name column on R-001 (the name match there is weak).

**SAY:** "Every red cell is evidence: *which* field, of *which* person, and *why*. An auditor never has to trust a black box."

**DO:** Click a member row: the record drawer opens. Close it.

### 4e. Case brief (15 s)
**DO:** Click **Generate case brief**. Show the paper view, point at Print. Close.

**SAY:** "One click gives the investigating officer a printable case file: evidence, shared accounts, members and recommended action."

### 4f. Money trail: kickbacks (25 s)
**DO:** Click **← All rings**, scroll to **R-015** and open it.

**SAY:** "This one is about money. **11 members forwarded most of their payout to one collector account within hours, and the collector's agents paid small commissions back.** We find that with cycle detection on the transfer graph. College fee accounts also receive money from many students, but days later and from hundreds of people, so they're never flagged."

### 4g. Prioritise (10 s)
**DO:** Click **← All rings**, then **Prioritise**.

**SAY:** "Investigators have limited time. Prioritise ranks rings by money recoverable per unit of effort. R-010 goes first."

### 4h. Human in the loop (15 s)
**DO:** Scroll to the bottom of the list, a low-risk ring such as **R-044** (risk 30). Click **Deflag**, type a note like "Field visit: genuine family".

**SAY:** "Low scores are shown, never hidden. A human can deflag a false alarm, and every count updates. We assist the auditor; we don't replace them."

### 4i. Stress test (20 s)
**DO:** Click **Stress test** → **All of the above**.

**SAY:** "What if fraudsters adapt: new accounts, different IPs, fresh SIMs? Detection drops from **29 to 5 rings**. But when we lean on signals that are expensive to fake, like biometrics, identity reuse and money cycles, we **recover 15**. Honest about the limit, and shows the defence." Close the drawer.

## 5. Lone threats (about 1 min)

**DO:** Click **Home** in the nav → **Use our dataset** → **Analyze Lone Threats**. (Or go straight to `/lone`.)

**SAY:** "Not every ghost is in a ring. Here, each colour is a red-flag signal: invalid Aadhaar, expired Aadhaar, bad phone, duplicate phone, login brute force, odd-hour registration. People linked to several signals sit between them."

**DO:** Click the **Login brute force** card. The cluster lights up.

**DO:** Click the first record, **Imran Kushwaha (B-000931)**.

**SAY:** "**25 failed logins in 4 minutes, then a success, at 3:49 at night, with an invalid phone number.** Look at the evidence bars: typical is zero failed logins. We combine signals with noisy-OR, so one honest typo doesn't flag anyone, but two independent problems do. Risk 95."

**DO:** Click **Confirm**. Then type a name in the search box (top right), e.g. `Pooja`, to show any record can be looked up.

## 6. Upload your own data (40 s, optional if short on time)

**DO:** Click **Change dataset** (top bar) → back on the landing page, under **Upload your own** choose `ml/data/test/ledger.csv` and `ml/data/test/transfers.csv` → **Upload & analyse**. It takes about 10 seconds.

**SAY:** "A department just uploads its ledger. Columns are validated, the full pipeline runs, and the same analysis appears for their data, here 20,000 new records in about ten seconds."

**DO:** Afterwards, **Change dataset → Use our dataset** to switch back (this clears Confirm/Deflag clicks).

## 7. Dataset & method (40 s)

**DO:** Click **Dataset & method** in the nav. Scroll slowly.

**SAY:**
- "We kept the data honest: **look-alikes for every signal**: twins, families, CSC centres, college fees, genuine typos, so no single rule can win."
- "**Two ring types were never used for tuning**, and the reported numbers come from a **separate test set run once.**"
- "Results: **35 of 35 rings, 1 false alarm. Lone ghosts F1 0.91.**"
- "And we validated on **public** data: identity matching **F1 0.99** on Febrl; on IBM's anti-money-laundering data, 4.5 million transfers, **45% of the cycles we flag are real laundering, 30 times better than random**."

## 8. Close (15 s)

**SAY:** "Unique-ID checks find zero of these rings. We find them, explain every flag with evidence, rank them by recoverable money, and keep a human in control. **It runs on a laptop: 200,000 records in under 80 seconds.** Thank you."

---

## Q&A cheat sheet

| Likely question | Answer |
|---|---|
| Is the data real? | Simulated, because real fraud labels are private. We controlled bias with look-alikes, noisy rings, held-out ring types and a separate test set, and validated components on public data (Febrl, IBM AML). |
| Isn't it circular, you built the data? | Partly, that's why: test set with a different seed and shifted noise, 2 ring types never tuned on, and public benchmarks we didn't design. |
| What algorithms? | Record linkage (edit-distance + Metaphone, DOB blocking, IP burst windows, sorted phone batches), entity graph with inverse-frequency weights, Louvain communities, bounded cycle detection, explainable ring risk index, noisy-OR + Isolation Forest for lone ghosts, PCA for the map. |
| Ring risk formula? | R = (42 + Σ wₛ·cₛ) × f. c = share of members with the signal, w = how expensive the signal is to fake (biometric 20 … address 8), f = 0.6 if they look like one family. |
| Lone formula? | P = 1 − Π(1 − pᵢ) (noisy-OR) + a small Isolation Forest boost; flag at 0.60 with at least one strong rule. |
| What about Aadhaar + OTP? | They prove a person is real, not who receives the money. Rings use real identities and divert the payout; we follow the shared accounts, devices and money. |
| False positives? | 1 false alarm ring on the test set; low-risk groups are shown so a human can deflag; families and CSC centres are discounted by design. |
| Scale? | 200,000 records + 176,000 transfers in 53–77 s on a laptop. |
| Privacy? | Aadhaar and phone are masked in every screen and API response. |
| Why not deep learning? | No labelled real data exists, and auditors need explanations. Graph + rules + Isolation Forest is explainable and works without labels. |

## If something breaks

- **Ring or Lone page shows "ML unavailable":** the ML service is still auditing. Wait 10 s and click Retry.
- **ML won't start:** set `MOCK=true` in `backend/.env`, restart the backend. The app runs on saved results (upload is disabled in this mode).
- **Graph looks empty:** wait 3 seconds; it settles. Or click a ring card on the right.
- **Anything else:** switch to the backup video and keep talking.
