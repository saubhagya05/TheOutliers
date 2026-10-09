// Deterministic mock audit in the same shape the ML service returns (docs/API.md section 3).
// Lets the frontend build against realistic data before the real dataset and ML exist.

import { riskLevel } from '../lib/http.js';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const pad = (n, w) => String(n).padStart(w, '0');
const hex = (len) => Array.from({ length: len }, () => Math.floor(rand() * 16).toString(16)).join('');
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const FIRST_M = ['Rajesh', 'Amit', 'Suresh', 'Rahul', 'Vikas', 'Manoj', 'Sanjay', 'Ravi', 'Deepak', 'Arjun', 'Rohit', 'Anil', 'Mohammed', 'Imran', 'Sunil', 'Pankaj', 'Abhishek', 'Nitin', 'Gaurav', 'Ajay'];
const FIRST_F = ['Asha', 'Sunita', 'Priya', 'Pooja', 'Meena', 'Anjali', 'Neha', 'Kavita', 'Rekha', 'Shabnam', 'Nisha', 'Rani', 'Sapna', 'Komal', 'Divya', 'Ritu', 'Seema', 'Kiran', 'Jyoti', 'Rubina'];
const LAST = ['Kumar', 'Singh', 'Yadav', 'Prasad', 'Sharma', 'Paswan', 'Mandal', 'Gupta', 'Khan', 'Ansari', 'Devi', 'Kumari', 'Ram', 'Mahto', 'Thakur', 'Jha', 'Mishra', 'Rai', 'Chaudhary', 'Sah'];
const DISTRICTS = [
  { name: 'Patna', town: 'Danapur', pin: 800 },
  { name: 'Nalanda', town: 'Rajgir', pin: 803 },
  { name: 'Gaya', town: 'Bodh Gaya', pin: 823 },
  { name: 'Muzaffarpur', town: 'Kanti', pin: 842 },
  { name: 'Bhagalpur', town: 'Naugachia', pin: 812 },
  { name: 'Darbhanga', town: 'Benipur', pin: 846 },
  { name: 'Purnia', town: 'Banmankhi', pin: 854 },
  { name: 'Saran', town: 'Chapra', pin: 841 },
];
const BANKS = [
  { name: 'SBI', ifsc: 'SBIN' },
  { name: 'PNB', ifsc: 'PUNB' },
  { name: 'BOB', ifsc: 'BARB' },
  { name: 'Canara', ifsc: 'CNRB' },
  { name: 'Union', ifsc: 'UBIN' },
];
const AMOUNTS = [30000, 45000, 60000, 90000];
const POPULATION = 3000;
const WINDOW_START = Date.UTC(2025, 6, 1);
const PAYOUT_DAY = Date.UTC(2025, 8, 5, 9);

const SIGNAL_LABELS = {
  sharedAccount: 'Shared payout account',
  sharedPhone: 'Shared phone number',
  sharedAddress: 'Shared address',
  similarName: 'Near-duplicate names',
  sharedDevice: 'Same OTP device / IP',
  sharedAgent: 'Same filing agent',
  timingBurst: 'Application burst',
  collectorAccount: 'Funds forwarded to one collector',
  newAccount: 'Accounts opened in a batch / very new',
  instantWithdrawal: 'Instant full withdrawal',
  oddHourApplication: 'Odd-hour application',
  registryMismatch: 'Not in enrolment registry',
  areaAnomaly: 'Area has too many beneficiaries',
};

export const COLUMNS = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'age', label: 'Age', type: 'number' },
  { key: 'gender', label: 'Gender', type: 'text' },
  { key: 'phoneMasked', label: 'Phone', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'district', label: 'District', type: 'text' },
  { key: 'pincode', label: 'Pincode', type: 'text' },
  { key: 'aadhaarHash', label: 'Aadhaar (hash)', type: 'text' },
  { key: 'payoutAccount', label: 'Payout account', type: 'text' },
  { key: 'ifsc', label: 'IFSC', type: 'text' },
  { key: 'transferredTo', label: 'Funds moved to', type: 'text' },
  { key: 'agentId', label: 'Agent', type: 'text' },
  { key: 'deviceId', label: 'OTP device', type: 'text' },
  { key: 'otpIp', label: 'OTP IP', type: 'text' },
  { key: 'accountOpenedAt', label: 'Account opened', type: 'datetime' },
  { key: 'appliedAt', label: 'Applied at', type: 'datetime' },
  { key: 'payoutAt', label: 'Paid at', type: 'datetime' },
  { key: 'amountInr', label: 'Amount', type: 'inr' },
  { key: 'minutesToWithdrawal', label: 'Mins to withdraw', type: 'number' },
  { key: 'enrolledInRegistry', label: 'In registry', type: 'boolean' },
  { key: 'riskScore', label: 'Risk', type: 'risk' },
];

const MEMBER_DEFAULTS = ['name', 'phoneMasked', 'address', 'payoutAccount', 'transferredTo', 'agentId', 'deviceId', 'accountOpenedAt', 'appliedAt', 'amountInr', 'minutesToWithdrawal', 'riskScore'];
const LONE_DEFAULTS = ['name', 'district', 'payoutAccount', 'accountOpenedAt', 'appliedAt', 'amountInr', 'minutesToWithdrawal', 'enrolledInRegistry', 'riskScore'];
const withDefaults = (keys) => COLUMNS.map((c) => ({ ...c, default: keys.includes(c.key) }));

// ---------- base population ----------

function makeAccount() {
  const bank = pick(BANKS);
  const last4 = pad(int(0, 9999), 4);
  return { id: `A-${hex(5).toUpperCase()}`, label: `${bank.name} ****${last4}`, ifsc: `${bank.ifsc}000${last4}` };
}

function makeRecord(i) {
  const gender = rand() < 0.5 ? 'M' : 'F';
  const district = pick(DISTRICTS);
  const account = makeAccount();
  const applied = WINDOW_START + int(0, 60) * DAY + int(9, 19) * 60 * MIN + int(0, 59) * MIN;
  const phone = `${pick(['6', '7', '8', '9'])}${pad(int(0, 999999999), 9)}`;
  const amount = pick(AMOUNTS);
  return {
    recordId: `B-${pad(i, 6)}`,
    name: `${pick(gender === 'M' ? FIRST_M : FIRST_F)} ${pick(LAST)}`,
    age: int(17, 26),
    gender,
    phone,
    address: `Ward ${int(1, 24)}, ${district.town}`,
    district: district.name,
    pincode: `${district.pin}${pad(int(1, 140), 3)}`,
    aadhaarHash: `${hex(4)}…${hex(2)}`,
    account,
    transferredTo: null,
    agentId: `AG-${pad(int(1, 40), 2)}`,
    deviceId: `D-${pad(int(1, 9999), 4)}`,
    otpIp: `10.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
    accountOpenedAt: applied - int(200, 1500) * DAY,
    appliedAt: applied,
    payoutAt: PAYOUT_DAY + int(0, 10) * DAY,
    amountInr: amount,
    minutesToWithdrawal: int(600, 20000),
    enrolledInRegistry: true,
    riskScore: rand() < 0.9 ? int(1, 25) : int(26, 39),
    kind: 'normal',
    ringId: null,
    anomalies: [],
    reasons: [],
    _variantName: false,
  };
}

const records = Array.from({ length: POPULATION }, (_, i) => makeRecord(i + 1));
const byId = new Map(records.map((r) => [r.recordId, r]));
const free = records.map((r) => r.recordId);

function takeFree(n, district) {
  const out = [];
  for (let i = 0; i < free.length && out.length < n; i++) {
    const r = byId.get(free[i]);
    if (!district || r.district === district) {
      out.push(r);
      free.splice(i, 1);
      i--;
    }
  }
  return out;
}

const maskPhone = (p) => `${p.slice(0, 2)}XXXXXX${p.slice(-2)}`;

export function toFields(r) {
  return {
    name: r.name,
    age: r.age,
    gender: r.gender,
    phoneMasked: maskPhone(r.phone),
    address: r.address,
    district: r.district,
    pincode: r.pincode,
    aadhaarHash: r.aadhaarHash,
    payoutAccount: r.account.label,
    ifsc: r.account.ifsc,
    transferredTo: r.transferredTo ? r.transferredTo.label : null,
    agentId: r.agentId,
    deviceId: r.deviceId,
    otpIp: r.otpIp,
    accountOpenedAt: iso(r.accountOpenedAt),
    appliedAt: iso(r.appliedAt),
    payoutAt: iso(r.payoutAt),
    amountInr: r.amountInr,
    minutesToWithdrawal: r.minutesToWithdrawal,
    enrolledInRegistry: r.enrolledInRegistry,
    riskScore: r.riskScore,
  };
}

// ---------- rings ----------

const RING_PLANS = [
  { type: 'sharedAccount', size: 14, traits: ['sharedAccount', 'sharedAgent', 'timingBurst', 'newAccount', 'instantWithdrawal'] },
  { type: 'deviceOtp', size: 11, traits: ['sharedDevice', 'sharedAgent', 'timingBurst'] },
  { type: 'collectorAccount', size: 9, traits: ['collectorAccount', 'instantWithdrawal', 'newAccount'] },
  { type: 'sharedAccount', size: 8, traits: ['sharedAccount', 'similarName', 'sharedPhone'] },
  { type: 'agentBurst', size: 16, traits: ['sharedAgent', 'timingBurst', 'sharedDevice'] },
  { type: 'sharedAddress', size: 7, traits: ['sharedAddress', 'sharedPhone', 'sharedAccount'] },
  { type: 'collectorAccount', size: 12, traits: ['collectorAccount', 'sharedAgent', 'timingBurst'] },
  { type: 'deviceOtp', size: 10, traits: ['sharedDevice', 'newAccount', 'instantWithdrawal'] },
  { type: 'sharedAccount', size: 6, traits: ['sharedAccount', 'similarName', 'sharedAddress'] },
  { type: 'agentBurst', size: 13, traits: ['sharedAgent', 'timingBurst', 'collectorAccount'] },
  { type: 'sharedPhone', size: 9, traits: ['sharedPhone', 'similarName', 'sharedAgent'] },
  { type: 'deviceOtp', size: 15, traits: ['sharedDevice', 'sharedAgent', 'sharedAccount', 'timingBurst'] },
  { type: 'collectorAccount', size: 8, traits: ['collectorAccount', 'newAccount', 'sharedPhone'] },
  // Hard negative: a real self-help group sharing one account and address. Low risk, good deflag demo.
  { type: 'sharedAccount', size: 6, traits: ['sharedAccount', 'sharedAddress'], hardNegative: true },
];

function applyTraits(members, traits, ringIndex, singleAccount) {
  const base = members[0];
  const burstStart = WINDOW_START + int(5, 50) * DAY + int(9, 17) * 60 * MIN;
  const sharedAccounts = [makeAccount(), makeAccount()];
  const sharedPhones = [base.phone, `${base.phone.slice(0, 6)}${pad(int(0, 9999), 4)}`];
  const agent = `AG-${pad(41 + ringIndex, 2)}`;
  const device = `D-${pad(9000 + ringIndex, 4)}`;
  const ip = `49.36.${ringIndex}.${int(2, 250)}`;
  const collector = makeAccount();
  const openBatch = Math.floor((burstStart - int(3, 9) * DAY) / DAY) * DAY;

  members.forEach((m, i) => {
    if (traits.includes('sharedAccount')) m.account = sharedAccounts[!singleAccount && i % 3 === 2 ? 1 : 0];
    if (traits.includes('sharedPhone')) m.phone = sharedPhones[i % 2];
    if (traits.includes('sharedAddress')) m.address = base.address;
    if (traits.includes('sharedAgent')) m.agentId = agent;
    if (traits.includes('sharedDevice')) {
      m.deviceId = device;
      m.otpIp = ip;
    }
    if (traits.includes('timingBurst')) m.appliedAt = burstStart + int(0, 40) * MIN;
    if (traits.includes('collectorAccount')) m.transferredTo = collector;
    if (traits.includes('newAccount')) {
      m.accountOpenedAt = openBatch + int(0, 1) * DAY;
      if (!traits.includes('timingBurst')) m.appliedAt = openBatch + int(2, 6) * DAY + int(9, 17) * 60 * MIN;
    }
    if (traits.includes('instantWithdrawal')) m.minutesToWithdrawal = int(2, 25);
    if (traits.includes('similarName') && i > 0 && i % 2 === 1) {
      const [first, last] = base.name.split(' ');
      m.name = pick([`${first} ${last}a`, `${first}a ${last}`, `${first.slice(0, -1)}${first.slice(-1).repeat(2)} ${last}`]);
      m._variantName = true;
    }
  });
}

const RING_FIELD_FOR = {
  sharedAccount: 'payoutAccount',
  sharedPhone: 'phoneMasked',
  sharedAddress: 'address',
  sharedAgent: 'agentId',
  sharedDevice: 'deviceId',
  collectorAccount: 'transferredTo',
};

function ringAnomalies(members) {
  const fieldsList = members.map(toFields);
  const counts = {};
  for (const [signal, field] of Object.entries(RING_FIELD_FOR)) {
    counts[signal] = {};
    for (const f of fieldsList) {
      const v = f[field];
      if (v) counts[signal][v] = (counts[signal][v] || 0) + 1;
    }
  }
  const times = members.map((m) => m.appliedAt).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const openTimes = members.map((m) => m.accountOpenedAt);

  members.forEach((m, idx) => {
    const f = fieldsList[idx];
    const anomalies = [];
    for (const [signal, field] of Object.entries(RING_FIELD_FOR)) {
      const n = counts[signal][f[field]] || 0;
      if (f[field] && n >= 2) {
        const label = signal === 'collectorAccount'
          ? `Funds forwarded to the same account as ${n - 1} other members`
          : `Same ${SIGNAL_LABELS[signal].replace('Shared ', '').replace('Same ', '').toLowerCase()} as ${n - 1} other member${n - 1 === 1 ? '' : 's'}`;
        anomalies.push({ field, signal, label });
      }
    }
    const inBurst = members.filter((o) => Math.abs(o.appliedAt - m.appliedAt) <= 60 * MIN).length;
    if (Math.abs(m.appliedAt - median) <= 60 * MIN && inBurst >= 4) {
      anomalies.push({ field: 'appliedAt', signal: 'timingBurst', label: `Applied within the same hour as ${inBurst - 1} other members` });
    }
    const sameBatch = openTimes.filter((t) => Math.abs(t - m.accountOpenedAt) <= 2 * DAY).length;
    if (sameBatch >= 4 && m.appliedAt - m.accountOpenedAt < 15 * DAY) {
      anomalies.push({ field: 'accountOpenedAt', signal: 'newAccount', label: `Account opened in a batch with ${sameBatch - 1} others, ${Math.round((m.appliedAt - m.accountOpenedAt) / DAY)} days before applying` });
    }
    if (m.minutesToWithdrawal < 30) {
      anomalies.push({ field: 'minutesToWithdrawal', signal: 'instantWithdrawal', label: `Full amount withdrawn ${m.minutesToWithdrawal} minutes after payout` });
    }
    if (m._variantName) {
      anomalies.push({ field: 'name', signal: 'similarName', label: 'Near-duplicate of another member\'s name' });
    }
    m.anomalies = anomalies;
  });
}

const ringReasonLabel = (signal, ring) => {
  const n = ring.members.length;
  const hubs = ring.sharedEntities;
  const hubCount = (type) => hubs.filter((h) => h.type === type).length;
  switch (signal) {
    case 'sharedAccount': { const k = hubCount('account') || 1; return `${n} beneficiaries pay out to ${k === 1 ? 'one bank account' : k + ' bank accounts'}`; }
    case 'sharedPhone': { const k = hubCount('phone') || 1; return `Members share ${k === 1 ? 'one phone number' : k + ' phone numbers'}`; }
    case 'sharedAddress': return 'Several members registered at the same address';
    case 'similarName': return 'Near-duplicate names among members';
    case 'sharedDevice': return 'One device completed OTPs for unrelated people';
    case 'sharedAgent': return `One agent filed ${n} applications`;
    case 'timingBurst': return 'Applications filed within 40 minutes';
    case 'collectorAccount': return 'Payouts forwarded to one collector account';
    case 'newAccount': return 'Accounts opened in a batch just before applying';
    case 'instantWithdrawal': return 'Money withdrawn within minutes of payout';
    default: return SIGNAL_LABELS[signal] || signal;
  }
};

const HUB_TYPE = { sharedAccount: 'account', sharedPhone: 'phone', sharedAddress: 'address', sharedAgent: 'agent', sharedDevice: 'device', collectorAccount: 'account' };

function buildRing(plan, index) {
  const ringId = `R-${pad(index + 1, 3)}`;
  const district = DISTRICTS[index % DISTRICTS.length].name;
  const members = takeFree(plan.size, district);
  applyTraits(members, plan.traits, index, plan.hardNegative);
  ringAnomalies(members);

  // shared hub nodes
  const hubs = new Map();
  const edges = [];
  for (const m of members) {
    const f = toFields(m);
    for (const a of m.anomalies) {
      const hubType = HUB_TYPE[a.signal];
      if (!hubType) continue;
      const value = f[a.field];
      const key = `${hubType}:${value}`;
      if (!hubs.has(key)) {
        const prefix = { account: 'A', phone: 'P', address: 'AD', agent: 'AG', device: 'D' }[hubType];
        const id = hubType === 'agent' ? value : hubType === 'device' ? value : `${prefix}-${ringId.slice(2)}${hubs.size + 1}`;
        hubs.set(key, { id, type: hubType, label: hubType === 'agent' ? `Agent ${value}` : value, linkedMembers: 0 });
      }
      const hub = hubs.get(key);
      hub.linkedMembers += 1;
      edges.push({ source: m.recordId, target: hub.id, type: a.signal, weight: 1 });
    }
  }
  // similar-name edges between members
  const variants = members.filter((m) => m._variantName);
  for (const v of variants) edges.push({ source: v.recordId, target: members[0].recordId, type: 'similarName', weight: 0.7 });

  const sharedEntities = [...hubs.values()];
  const signalCounts = {};
  for (const m of members) for (const a of m.anomalies) signalCounts[a.signal] = (signalCounts[a.signal] || 0) + 1;
  const total = Object.values(signalCounts).reduce((s, v) => s + v, 0) || 1;
  const ring = { members, sharedEntities };
  const reasons = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([signal, c]) => ({ signal, label: ringReasonLabel(signal, ring), weight: Math.round((c / total) * 100) / 100 }));
  const signalBreakdown = Object.entries(signalCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([signal, c]) => ({ signal, label: SIGNAL_LABELS[signal], value: Math.round((c / members.length) * 100) / 100 }));

  const riskScore = plan.hardNegative ? int(30, 38) : Math.min(98, 62 + reasons.length * 6 + int(0, 8));
  for (const m of members) {
    m.kind = 'ringMember';
    m.ringId = ringId;
    m.riskScore = Math.max(20, Math.min(99, riskScore + int(-6, 4)));
    m.reasons = reasons.slice(0, 3);
  }
  const amountAtRiskInr = members.reduce((s, m) => s + m.amountInr, 0);

  const nodes = [
    ...members.map((m) => ({ id: m.recordId, type: 'beneficiary', label: m.name, ringId, riskScore: m.riskScore })),
    ...sharedEntities.map((h) => ({ id: h.id, type: h.type, label: h.label, ringId, riskScore })),
  ];

  const timeline = members
    .flatMap((m) => [
      { at: iso(m.appliedAt), event: 'application', recordId: m.recordId },
      { at: iso(m.payoutAt), event: 'payout', recordId: m.recordId, amountInr: m.amountInr },
      { at: iso(m.payoutAt + m.minutesToWithdrawal * MIN), event: 'withdrawal', recordId: m.recordId, amountInr: m.amountInr },
    ])
    .sort((a, b) => a.at.localeCompare(b.at));

  const top = reasons.slice(0, 3).map((r) => r.label.charAt(0).toLowerCase() + r.label.slice(1));
  const summary = plan.hardNegative
    ? `${members.length} beneficiaries share one bank account and address in ${district}. The pattern matches a self-help group, so the score is low; verify before acting.`
    : `${members.length} beneficiaries in ${district} with different names and Aadhaar IDs are linked: ${top.join('; ')}. ₹${(amountAtRiskInr / 100000).toFixed(1)} lakh is at risk.`;

  return {
    ringId,
    riskScore,
    riskLevel: riskLevel(riskScore),
    district,
    ringType: plan.type,
    memberCount: members.length,
    amountAtRiskInr,
    summary,
    reasons,
    topReasons: reasons.slice(0, 3),
    signalBreakdown,
    sharedEntities,
    graph: { nodes, edges },
    timeline,
    _members: members,
    _hardNegative: !!plan.hardNegative,
  };
}

const rings = RING_PLANS.map(buildRing);

// investigation priority: more recoverable money and less effort = investigate first
const maxRecoverable = Math.max(...rings.map((r) => r.amountAtRiskInr));
for (const r of rings) {
  const districts = new Set(r._members.map((m) => m.district)).size;
  const effort = r.memberCount <= 8 && districts === 1 ? 'low' : r.memberCount >= 13 ? 'high' : 'medium';
  const recoverableInr = Math.round((r.amountAtRiskInr * (r._hardNegative ? 0.1 : 0.6 + rand() * 0.35)) / 1000) * 1000;
  const bonus = { low: 30, medium: 18, high: 6 }[effort];
  r.priority = { priorityScore: Math.min(100, Math.round((recoverableInr / maxRecoverable) * 70 + bonus)), rank: 0, recoverableInr, effort };
}
[...rings].sort((a, b) => b.priority.priorityScore - a.priority.priorityScore).forEach((r, i) => { r.priority.rank = i + 1; });

// ---------- lone ghosts ----------

const LONE_TRAITS = ['newAccount', 'instantWithdrawal', 'oddHourApplication', 'registryMismatch', 'areaAnomaly'];
const LONE_FIELD = { newAccount: 'accountOpenedAt', instantWithdrawal: 'minutesToWithdrawal', oddHourApplication: 'appliedAt', registryMismatch: 'enrolledInRegistry', areaAnomaly: 'pincode' };
const LONE_WEIGHT = { instantWithdrawal: 0.35, newAccount: 0.27, registryMismatch: 0.22, oddHourApplication: 0.1, areaAnomaly: 0.06 };

const lone = takeFree(110).map((r) => {
  const n = rand() < 0.4 ? 3 : 2;
  const traits = [...LONE_TRAITS].sort(() => rand() - 0.5).slice(0, n);
  const anomalies = [];
  for (const t of traits) {
    if (t === 'newAccount') {
      const days = int(1, 6);
      r.accountOpenedAt = r.appliedAt - days * DAY;
      anomalies.push({ field: LONE_FIELD[t], signal: t, label: `Account opened ${days} days before applying` });
    } else if (t === 'instantWithdrawal') {
      r.minutesToWithdrawal = int(2, 15);
      anomalies.push({ field: LONE_FIELD[t], signal: t, label: `Full amount withdrawn ${r.minutesToWithdrawal} minutes after payout` });
    } else if (t === 'oddHourApplication') {
      const d = new Date(r.appliedAt);
      d.setUTCHours(int(1, 4), int(0, 59));
      r.appliedAt = d.getTime();
      anomalies.push({ field: LONE_FIELD[t], signal: t, label: `Applied at ${d.getUTCHours()}:${pad(d.getUTCMinutes(), 2)} at night` });
    } else if (t === 'registryMismatch') {
      r.enrolledInRegistry = false;
      anomalies.push({ field: LONE_FIELD[t], signal: t, label: 'Not found in the school enrolment registry' });
    } else if (t === 'areaAnomaly') {
      anomalies.push({ field: LONE_FIELD[t], signal: t, label: `Pincode ${r.pincode} has 3.4x more beneficiaries than eligible students` });
    }
  }
  r.kind = 'lone';
  r.anomalies = anomalies;
  r.riskScore = Math.min(97, 40 + anomalies.reduce((s, a) => s + LONE_WEIGHT[a.signal] * 60, 0) + int(0, 12)) | 0;
  r.reasons = anomalies
    .map((a) => ({ signal: a.signal, label: a.label, weight: LONE_WEIGHT[a.signal] }))
    .sort((a, b) => b.weight - a.weight);
  return r;
});

// ---------- baseline: exact duplicate Aadhaar only ----------

const dupes = takeFree(6);
for (let i = 0; i < dupes.length; i += 2) {
  dupes[i + 1].aadhaarHash = dupes[i].aadhaarHash;
  dupes[i].riskScore = dupes[i + 1].riskScore = int(30, 38);
}
const ringMemberCount = rings.filter((r) => !r._hardNegative).reduce((s, r) => s + r.memberCount, 0);
const ringAmount = rings.filter((r) => !r._hardNegative).reduce((s, r) => s + r.amountAtRiskInr, 0);
const loneAmount = lone.reduce((s, r) => s + r.amountInr, 0);
const realRings = rings.filter((r) => !r._hardNegative).length;

const baseline = {
  baseline: {
    method: 'Unique Aadhaar / ID check',
    recordsFlagged: dupes.length,
    ringsDetected: 0,
    amountCaughtInr: dupes.reduce((s, r) => s + r.amountInr, 0),
    flaggedRecordIds: dupes.map((r) => r.recordId),
  },
  ours: {
    method: 'Graph linkage + behaviour scoring',
    recordsFlagged: ringMemberCount + lone.length,
    ringsDetected: realRings,
    amountCaughtInr: ringAmount + loneAmount,
  },
  planted: { rings: realRings + 2, loneGhosts: lone.length + 18 },
  headline: `The unique-ID check catches 0 of ${realRings} rings. Our graph catches all ${realRings}.`,
};

// ---------- scatter points (fake 2-D projection) ----------

const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
const clamp01 = (v) => Math.max(0.02, Math.min(0.98, v));
const pointFor = (r) => {
  if (r.kind === 'lone') {
    const angle = rand() * Math.PI * 2;
    const radius = 0.28 + (r.riskScore / 100) * 0.2;
    return { x: clamp01(0.45 + Math.cos(angle) * radius), y: clamp01(0.5 + Math.sin(angle) * radius) };
  }
  return { x: clamp01(0.45 + gauss() * 0.16), y: clamp01(0.5 + gauss() * 0.16) };
};
const topSignal = (r) => (r.reasons[0] ? r.reasons[0].signal : null);
const points = records
  .filter((r) => r.kind !== 'ringMember')
  .map((r) => ({ recordId: r.recordId, ...pointFor(r), riskScore: r.riskScore, riskLevel: riskLevel(r.riskScore), flagged: r.kind === 'lone', topSignal: r.kind === 'lone' ? topSignal(r) : null }));

// ---------- feature medians for "this vs typical" ----------

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const normals = records.filter((r) => r.kind === 'normal');
const TYPICAL = {
  accountAgeDays: median(normals.map((r) => Math.round((r.appliedAt - r.accountOpenedAt) / DAY))),
  minutesToWithdrawal: median(normals.map((r) => r.minutesToWithdrawal)),
  appliedHour: median(normals.map((r) => new Date(r.appliedAt).getUTCHours())),
};

function featuresFor(r) {
  const signals = new Set(r.anomalies.map((a) => a.signal));
  return [
    { key: 'accountAgeDays', label: 'Account age at application (days)', value: Math.round((r.appliedAt - r.accountOpenedAt) / DAY), typical: TYPICAL.accountAgeDays, anomalous: signals.has('newAccount') },
    { key: 'minutesToWithdrawal', label: 'Minutes from payout to withdrawal', value: r.minutesToWithdrawal, typical: TYPICAL.minutesToWithdrawal, anomalous: signals.has('instantWithdrawal') },
    { key: 'appliedHour', label: 'Hour of application (UTC)', value: new Date(r.appliedAt).getUTCHours(), typical: TYPICAL.appliedHour, anomalous: signals.has('oddHourApplication') || signals.has('timingBurst') },
  ];
}

// ---------- public shapes (ML contract, without Express-added fields) ----------

const rowOf = (r) => ({ recordId: r.recordId, fields: toFields(r), anomalies: r.anomalies, riskScore: r.riskScore, riskLevel: riskLevel(r.riskScore) });

const memberColumns = withDefaults(MEMBER_DEFAULTS);
const loneColumns = withDefaults(LONE_DEFAULTS);

export const bundle = {
  auditId: 'AUD-MOCK',
  finishedAt: '2026-09-27T02:01:12Z',
  datasetName: 'Post-Matric Scholarship 2025-26 (mock data)',
  recordsScanned: POPULATION,
  memberColumns,
  loneColumns,
  rings: rings.map(({ _members, _hardNegative, ...r }) => ({ ...r, columns: memberColumns, members: _members.map(rowOf) })),
  contextNodes: normals.slice(0, 2000).map((r) => ({ id: r.recordId, type: 'beneficiary', label: r.name, ringId: null, riskScore: r.riskScore })),
  lone: lone.map((r) => ({ ...rowOf(r), topReasons: r.reasons.slice(0, 3) })),
  points,
  baseline,
};

export function getRecord(recordId) {
  const r = byId.get(recordId);
  if (!r) return null;
  return {
    ...rowOf(r),
    columns: withDefaults(COLUMNS.map((c) => c.key)),
    reasons: r.reasons,
    features: featuresFor(r),
    kind: r.kind,
    ringId: r.ringId,
  };
}

export function searchRecords(q, limit) {
  const needle = q.toLowerCase();
  const out = [];
  for (const r of records) {
    if (r.name.toLowerCase().includes(needle) || r.recordId.toLowerCase().includes(needle) || r.phone.endsWith(needle)) {
      out.push({ recordId: r.recordId, name: r.name, district: r.district, riskScore: r.riskScore, kind: r.kind });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function buildBrief(ring) {
  const members = ring.members;
  const fmt = (n) => `₹${(n / 100000).toFixed(1)} lakh`;
  const evidence = ring.reasons.map((r) => `- ${r.label}`).join('\n');
  const hubs = ring.sharedEntities.map((h) => `- ${h.label} (${h.type}, linked to ${h.linkedMembers} members)`).join('\n');
  const memberLines = members.map((m) => `- ${m.recordId} ${m.fields.name}, ${m.fields.address}, ${m.fields.payoutAccount}, ₹${m.fields.amountInr}`).join('\n');
  const accounts = ring.sharedEntities.filter((h) => h.type === 'account').map((h) => h.label);
  const agents = ring.sharedEntities.filter((h) => h.type === 'agent').map((h) => h.label);
  const action = [
    accounts.length ? `Freeze or hold payouts to ${accounts.join(', ')}.` : 'Hold further payouts to members pending verification.',
    agents.length ? `Question ${agents.join(', ')} about the applications they filed.` : null,
    'Field-verify a sample of 3 members at their registered addresses.',
  ].filter(Boolean).join(' ');
  const sections = [
    { heading: 'Summary', body: `${ring.summary} Risk score ${ring.riskScore}/100. Estimated recoverable: ${fmt(ring.priority.recoverableInr)}.` },
    { heading: 'Evidence', body: evidence },
    { heading: 'Shared items', body: hubs || 'None' },
    { heading: 'Members', body: memberLines },
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

export const stressScenarios = [
  { id: 'freshAccounts', label: 'Ring opens a fresh account per member', description: 'Removes the shared-account signal.', lost: ['sharedAccount'] },
  { id: 'spreadTiming', label: 'Ring spreads applications over 3 weeks', description: 'Removes the timing-burst signal.', lost: ['timingBurst'] },
  { id: 'freshDevices', label: 'Ring uses a new phone/device per member', description: 'Removes device and phone signals.', lost: ['sharedDevice', 'sharedPhone'] },
  { id: 'allAdaptations', label: 'All of the above', description: 'Worst case.', lost: ['sharedAccount', 'timingBurst', 'sharedDevice', 'sharedPhone'] },
];

export function runStressTest(scenarioId) {
  const scenario = stressScenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  const THRESHOLD = 60;
  const real = bundle.rings.filter((r) => r.riskScore >= 40);
  const planted = baseline.planted.rings;
  const rows = real.map((r) => {
    // Losing one of a ring's top-2 signals hurts a lot; other signals then recover part of the score.
    const lostTop = r.reasons.slice(0, 2).filter((x) => scenario.lost.includes(x.signal)).length;
    const lostOther = r.reasons.slice(2).filter((x) => scenario.lost.includes(x.signal)).length;
    const remaining = r.reasons.filter((x) => !scenario.lost.includes(x.signal));
    const adapted = Math.max(5, r.riskScore - lostTop * 30 - lostOther * 8);
    const recovered = remaining.length >= 2 ? Math.round(adapted + (r.riskScore - adapted) * 0.7) : adapted + 4;
    return { ringId: r.ringId, before: r.riskScore, adapted, recovered, detectedAfter: recovered >= THRESHOLD, remaining: remaining.map((x) => x.signal) };
  });
  const count = (key) => rows.filter((x) => x[key] >= THRESHOLD).length;
  const round2 = (v) => Math.round(v * 100) / 100;
  const used = [...new Set(rows.filter((x) => x.detectedAfter).flatMap((x) => x.remaining))].slice(0, 4);
  const before = count('before');
  const adapted = count('adapted');
  const recovered = count('recovered');
  return {
    scenario: scenario.id,
    before: { ringsDetected: before, recall: round2(before / planted) },
    adapted: { ringsDetected: adapted, recall: round2(adapted / planted), lostSignals: scenario.lost },
    recovered: { ringsDetected: recovered, recall: round2(recovered / planted), signalsUsed: used },
    rings: rows.map(({ remaining, ...x }) => x),
    takeaway: `Adapting drops detection from ${before} to ${adapted} rings; the remaining signals (${used.join(', ')}) recover ${recovered}.`,
  };
}
