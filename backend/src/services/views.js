// Merges human decisions over the ML (or mock) output and adds Express-owned fields:
// status, manualOverride, note, ring colour, activeMemberCount.
import { provider } from '../providers/index.js';
import { getOverride, recordOverrides } from './overrides.js';

// Distinct, bright colours that read well on the black canvas. Index = ring order from ML.
export const RING_COLORS = [
  '#FF3B3B', '#FF8A3D', '#FFD23F', '#3DDC97', '#3AB0FF', '#9B6BFF', '#FF5FC1', '#00E5FF',
  '#C6FF3D', '#FF6F61', '#B0B7FF', '#7CFFCB', '#FFA8E2', '#8AE1FC', '#F4A261', '#E9C46A',
];

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
    color: RING_COLORS[index % RING_COLORS.length],
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
