// Merges human decisions over the ML (or mock) output and adds Express-owned fields:
// status, manualOverride, note, ring colour, activeMemberCount.
import { provider } from '../providers/index.js';
import { getOverride, recordOverrides } from './overrides.js';

// Distinct, bright colours on the black canvas for any number of rings: golden-angle hue steps from red.
function hslToHex(h, sat, light) {
  const a = sat * Math.min(light, 1 - light);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}
export const ringColor = (index) => hslToHex((index * 137.508) % 360, 0.9, index % 2 ? 0.66 : 0.58);

export function recordState(recordId, defaultStatus) {
  const o = getOverride('record', recordId);
  return o
    ? { status: o.status, manualOverride: true, note: o.note }
    : { status: defaultStatus, manualOverride: false, note: null };
}

function ringState(ringId) {
  const o = getOverride('ring', ringId);
  return o
    ? { status: o.status, manualOverride: true, note: o.note }
    : { status: 'flagged', manualOverride: false, note: null };
}

export const defaultStatusForKind = (kind) => (kind === 'normal' ? 'notFlagged' : 'flagged');

function ringDetailView(ring, index) {
  const state = ringState(ring.ringId);
  const members = ring.members.map((m) => ({ ...m, ...recordState(m.recordId, 'flagged') }));
  const active = members.filter((m) => m.status !== 'deflagged');
  const memberStatus = new Map(members.map((m) => [m.recordId, m.status]));
  return {
    ...ring,
    color: ringColor(index),
    ...state,
    activeMemberCount: active.length,
    amountAtRiskInr: active.reduce((s, m) => s + (m.fields.amountInr || 0), 0),
    members,
    graph: {
      nodes: ring.graph.nodes.map((n) => ({ ...n, status: memberStatus.get(n.id) ?? state.status })),
      edges: ring.graph.edges,
    },
  };
}

export async function ringViews() {
  const bundle = await provider.getBundle();
  return bundle.rings.map(ringDetailView);
}

export function ringListItem(view) {
  const { members, graph, timeline, columns, sharedEntities, signalBreakdown, reasons, summary, ...item } = view;
  return item;
}

export async function loneViews() {
  const bundle = await provider.getBundle();
  const items = bundle.lone.map((r) => ({ ...r, ...recordState(r.recordId, 'flagged') }));
  const known = new Set(items.map((i) => i.recordId));
  const ringMemberIds = new Set(bundle.rings.flatMap((r) => r.members.map((m) => m.recordId)));

  // Records a human flagged manually join the lone list.
  for (const [recordId, o] of recordOverrides()) {
    if (known.has(recordId) || ringMemberIds.has(recordId) || !o.snapshot || o.status === 'deflagged') continue;
    const s = o.snapshot;
    items.push({
      recordId,
      fields: s.fields,
      anomalies: s.anomalies,
      topReasons: (s.reasons || []).slice(0, 3),
      riskScore: s.riskScore,
      riskLevel: s.riskLevel,
      status: o.status,
      manualOverride: true,
      note: o.note,
    });
  }
  return items;
}

const isActive = (status) => status === 'flagged' || status === 'confirmed';

export async function pointViews() {
  const bundle = await provider.getBundle();
  return bundle.points.map((p) => {
    const state = recordState(p.recordId, p.flagged ? 'flagged' : 'notFlagged');
    return { ...p, status: state.status, flagged: isActive(state.status) };
  });
}
