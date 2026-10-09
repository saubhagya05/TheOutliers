// Mock mode data: the oracle bundle (built from the real dataset by ml/data/build_mock_bundle.py)
// plus the real ledger for record lookup and search. Same interface the ML service will provide.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { riskLevel } from '../lib/http.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, '../../../ml/data');

export const bundle = JSON.parse(fs.readFileSync(path.join(here, 'bundle.json'), 'utf8'));
export const datasetInfo = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dataset_info.json'), 'utf8'));

// ---------- ledger.csv ----------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const ledger = parseCsv(fs.readFileSync(path.join(DATA_DIR, 'ledger.csv'), 'utf8'));
const byId = new Map(ledger.map((r) => [r.beneficiary_id, r]));
const countBy = (key) => ledger.reduce((m, r) => m.set(r[key], (m.get(r[key]) || 0) + 1), new Map());
const phoneCount = countBy('phone');
const accountCount = countBy('bank_account_number');
const ipCount = countBy('registration_ip');

// Must match to_fields() in ml/data/build_mock_bundle.py and pipeline/explain.py.
const maskPhone = (p) => (p.length >= 6 ? p.slice(0, 4) + 'X'.repeat(p.length - 6) + p.slice(-2) : 'X'.repeat(p.length));
function toFields(r, risk) {
  return {
    name: r.full_name, fatherName: r.father_name, spouseName: r.spouse_name || null,
    gender: r.gender, dob: r.dob, age: Number(r.age),
    aadhaarMasked: `XXXX XXXX ${r.aadhaar_number.slice(-4)}`, aadhaarStatus: r.aadhaar_status,
    biometricHash: r.biometric_hash.slice(0, 10), phoneMasked: maskPhone(r.phone), email: r.email || null,
    address: `${r.address_line}, ${r.village_town}`, district: r.district, state: r.state, pincode: r.pincode,
    registrationIp: r.registration_ip, registrationChannel: r.registration_channel,
    registrationAt: r.registration_ts, appliedAt: r.application_ts,
    bankAccount: `${r.bank_name} ****${r.bank_account_number.slice(-4)}`, ifsc: r.ifsc, upiId: r.upi_id || null,
    payoutMode: r.payout_mode, amountInr: Number(r.amount_inr), payoutAt: r.payout_ts,
    loginFailed: Number(r.login_attempts_failed), loginWindowMinutes: Number(r.login_window_minutes),
    riskScore: risk,
  };
}

// ---------- flagged records from the bundle ----------

const flagged = new Map();
for (const ring of bundle.rings) {
  for (const m of ring.members) flagged.set(m.recordId, { row: m, kind: 'ringMember', ringId: ring.ringId, reasons: ring.reasons });
}
for (const l of bundle.lone) flagged.set(l.recordId, { row: l, kind: 'lone', ringId: null, reasons: l.topReasons });
const pointRisk = new Map(bundle.points.map((p) => [p.recordId, p.riskScore]));
const baseRisk = (id) => pointRisk.get(id) ?? 5 + (Number(id.slice(-3)) % 20);

const median = (arr) => [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)];
const TYPICAL = {
  loginFailed: median(ledger.map((r) => Number(r.login_attempts_failed))),
  loginWindowMinutes: median(ledger.map((r) => Number(r.login_window_minutes))),
  registrationHour: median(ledger.map((r) => new Date(r.registration_ts).getUTCHours())),
};

function featuresFor(r, anomalies) {
  const has = (...signals) => anomalies.some((a) => signals.includes(a.signal));
  return [
    { key: 'loginFailed', label: 'Failed logins before success', value: Number(r.login_attempts_failed), typical: TYPICAL.loginFailed, anomalous: has('loginBruteforce') },
    { key: 'loginWindowMinutes', label: 'Login window (minutes)', value: Number(r.login_window_minutes), typical: TYPICAL.loginWindowMinutes, anomalous: has('loginBruteforce') },
    { key: 'phoneSharedWith', label: 'Other records with this phone', value: phoneCount.get(r.phone) - 1, typical: 0, anomalous: has('duplicatePhone', 'sharedPhone') },
    { key: 'accountSharedWith', label: 'Other records paid to this account', value: accountCount.get(r.bank_account_number) - 1, typical: 0, anomalous: has('sharedAccount') },
    { key: 'ipSharedWith', label: 'Other records registered from this IP', value: ipCount.get(r.registration_ip) - 1, typical: 0, anomalous: has('sharedIp', 'registrationBurst') },
    { key: 'registrationHour', label: 'Hour of registration (UTC)', value: new Date(r.registration_ts).getUTCHours(), typical: TYPICAL.registrationHour, anomalous: has('oddHourRegistration', 'registrationBurst') },
  ];
}

const allColumns = bundle.memberColumns.map((c) => ({ ...c, default: true }));

export function getRecord(recordId) {
  const r = byId.get(recordId);
  if (!r) return null;
  const f = flagged.get(recordId);
  const risk = f ? f.row.riskScore : baseRisk(recordId);
  const anomalies = f ? f.row.anomalies : [];
  return {
    recordId,
    fields: f ? f.row.fields : toFields(r, risk),
    anomalies,
    columns: allColumns,
    reasons: f ? f.reasons : [],
    features: featuresFor(r, anomalies),
    kind: f ? f.kind : 'normal',
    ringId: f ? f.ringId : null,
    riskScore: risk,
    riskLevel: riskLevel(risk),
  };
}

export function searchRecords(q, limit) {
  const needle = q.toLowerCase();
  const out = [];
  for (const r of ledger) {
    if (r.full_name.toLowerCase().includes(needle) || r.beneficiary_id.toLowerCase().includes(needle) || r.phone.endsWith(needle)) {
      const f = flagged.get(r.beneficiary_id);
      out.push({ recordId: r.beneficiary_id, name: r.full_name, district: r.district, riskScore: f ? f.row.riskScore : baseRisk(r.beneficiary_id), kind: f ? f.kind : 'normal' });
      if (out.length >= limit) break;
    }
  }
  return out;
}

// ---------- case brief (template) ----------

export function buildBrief(ring) {
  const lakh = (n) => `₹${(n / 100000).toFixed(1)} lakh`;
  const accounts = ring.sharedEntities.filter((h) => h.type === 'account' || h.type === 'upi').map((h) => h.label);
  const ips = ring.sharedEntities.filter((h) => h.type === 'ip').map((h) => h.label);
  const action = [
    accounts.length ? `Hold payouts to and freeze ${accounts.join(', ')}.` : 'Hold further payouts to members pending verification.',
    ips.length ? `Trace who registered from IP ${ips.join(', ')}.` : null,
    'Field-verify a sample of 3 members at their registered addresses.',
  ].filter(Boolean).join(' ');
  const sections = [
    { heading: 'Summary', body: `${ring.summary} Risk score ${ring.riskScore}/100. Estimated recoverable: ${lakh(ring.priority.recoverableInr)}.` },
    { heading: 'Evidence', body: ring.reasons.map((r) => `- ${r.label}`).join('\n') },
    { heading: 'Shared items', body: ring.sharedEntities.map((h) => `- ${h.label} (${h.type}, linked to ${h.linkedMembers})`).join('\n') || 'None' },
    { heading: 'Members', body: ring.members.map((m) => `- ${m.recordId} ${m.fields.name}, ${m.fields.address}, ${m.fields.bankAccount}, ₹${m.fields.amountInr}`).join('\n') },
    { heading: 'Recommended action', body: action },
  ];
  const title = `Case brief: Ring ${ring.ringId} (${ring.district})`;
  return {
    ringId: ring.ringId,
    generatedAt: new Date().toISOString(),
    generatedBy: 'template',
    title,
    sections,
    markdown: `# ${title}\n\n${sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n')}\n`,
  };
}

// ---------- stress test ("what if fraudsters adapt") ----------

export const stressScenarios = [
  { id: 'freshAccounts', label: 'Ring opens a fresh bank account and UPI ID per member', description: 'Removes shared-account and shared-UPI signals.', lost: ['sharedAccount', 'sharedUpi'] },
  { id: 'spreadOut', label: 'Ring registers from different IPs over weeks', description: 'Removes shared-IP and burst signals.', lost: ['sharedIp', 'registrationBurst'] },
  { id: 'freshContacts', label: 'Ring buys unrelated SIMs and real-looking emails', description: 'Removes batch-phone, shared-phone and templated-email signals.', lost: ['batchPhone', 'sharedPhone', 'templatedEmail'] },
  { id: 'allAdaptations', label: 'All of the above', description: 'Worst case.', lost: ['sharedAccount', 'sharedUpi', 'sharedIp', 'registrationBurst', 'batchPhone', 'sharedPhone', 'templatedEmail'] },
];

export function runStressTest(scenarioId) {
  const scenario = stressScenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  const THRESHOLD = 60;
  const planted = bundle.baseline.planted.rings;
  const rows = bundle.rings.filter((r) => r.riskScore >= 40).map((r) => {
    // Losing one of a ring's top-2 signals hurts a lot; the remaining signals then recover part of the score.
    const lostTop = r.reasons.slice(0, 2).filter((x) => scenario.lost.includes(x.signal)).length;
    const lostOther = r.reasons.slice(2).filter((x) => scenario.lost.includes(x.signal)).length;
    const remaining = r.reasons.filter((x) => !scenario.lost.includes(x.signal));
    const adapted = Math.max(5, r.riskScore - lostTop * 22 - lostOther * 6);
    const recovered = remaining.length >= 2 ? Math.round(adapted + (r.riskScore - adapted) * 0.6) : adapted + 3;
    return { ringId: r.ringId, before: r.riskScore, adapted, recovered, detectedAfter: recovered >= THRESHOLD, remaining: remaining.map((x) => x.signal) };
  });
  const count = (key) => rows.filter((x) => x[key] >= THRESHOLD).length;
  const round2 = (v) => Math.round(v * 100) / 100;
  const used = [...new Set(rows.filter((x) => x.detectedAfter).flatMap((x) => x.remaining))].slice(0, 4);
  const [before, adapted, recovered] = [count('before'), count('adapted'), count('recovered')];
  return {
    scenario: scenario.id,
    before: { ringsDetected: before, recall: round2(before / planted) },
    adapted: { ringsDetected: adapted, recall: round2(adapted / planted), lostSignals: scenario.lost },
    recovered: { ringsDetected: recovered, recall: round2(recovered / planted), signalsUsed: used },
    rings: rows.map(({ remaining, ...x }) => x),
    takeaway: `Adapting drops detection from ${before} to ${adapted} rings; the remaining signals (${used.join(', ')}) recover ${recovered}.`,
  };
}
