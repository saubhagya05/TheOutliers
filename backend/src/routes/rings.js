import { Router } from 'express';
import { asyncHandler, badRequest, notFound, paginate, parseIntIn, parseList, sortItems } from '../lib/http.js';
import { provider } from '../providers/index.js';
import { setOverride, clearOverride } from '../services/overrides.js';
import { ringViews, ringListItem, recordState } from '../services/views.js';

export const ringsRouter = Router();

export const MANUAL_STATUSES = ['flagged', 'confirmed', 'deflagged'];
const ALL_STATUSES = ['flagged', 'confirmed', 'deflagged'];

export function validateStatusBody(body) {
  const { status, note } = body || {};
  if (!MANUAL_STATUSES.includes(status)) throw badRequest(`status must be one of ${MANUAL_STATUSES.join(', ')}`);
  if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) throw badRequest('note must be a string of at most 500 characters');
  return { status, note: note || null };
}

async function findRing(ringId) {
  const ring = (await ringViews()).find((r) => r.ringId === ringId);
  if (!ring) throw notFound(`Ring ${ringId} does not exist`);
  return ring;
}

// Must be registered before /:ringId.
ringsRouter.get('/graph', asyncHandler(async (req, res) => {
  const q = req.query;
  const statuses = parseList(q.status, ['flagged', 'confirmed']);
  const minRisk = parseIntIn(q.minRisk, 0, 0, 100);
  const selected = (await ringViews()).filter((r) => statuses.includes(r.status) && r.riskScore >= minRisk);

  const nodes = new Map();
  const edges = [];
  for (const r of selected) {
    for (const n of r.graph.nodes) if (!nodes.has(n.id)) nodes.set(n.id, n);
    edges.push(...r.graph.edges);
  }
  if (q.includeContext !== 'false') {
    const bundle = await provider.getBundle();
    const limit = parseIntIn(q.contextNodes, 300, 0, 2000);
    for (const n of bundle.contextNodes.slice(0, limit)) {
      if (!nodes.has(n.id)) nodes.set(n.id, { ...n, status: recordState(n.id, 'notFlagged').status });
    }
  }
  res.json({
    nodes: [...nodes.values()],
    edges,
    rings: selected.map((r) => ({
      ringId: r.ringId, color: r.color, riskScore: r.riskScore, riskLevel: r.riskLevel,
      memberCount: r.memberCount, activeMemberCount: r.activeMemberCount, status: r.status,
    })),
  });
}));

const RING_SORTS = {
  riskScore: (r) => r.riskScore,
  priorityScore: (r) => r.priority.priorityScore,
  amountAtRiskInr: (r) => r.amountAtRiskInr,
  memberCount: (r) => r.memberCount,
};

ringsRouter.get('/', asyncHandler(async (req, res) => {
  const q = req.query;
  const statuses = parseList(q.status, ALL_STATUSES);
  const minRisk = parseIntIn(q.minRisk, 0, 0, 100);
  const sortKey = RING_SORTS[q.sort] ? q.sort : 'riskScore';
  let items = (await ringViews())
    .filter((r) => statuses.includes(r.status))
    .filter((r) => r.riskScore >= minRisk)
    .filter((r) => !q.level || r.riskLevel === q.level)
    .filter((r) => !q.district || r.district.toLowerCase() === String(q.district).toLowerCase());
  items = sortItems(items, RING_SORTS[sortKey], q.order === 'asc' ? 'asc' : 'desc');
  res.json(paginate(items.map(ringListItem), q));
}));

ringsRouter.get('/:ringId', asyncHandler(async (req, res) => {
  res.json(await findRing(req.params.ringId));
}));

ringsRouter.put('/:ringId/status', asyncHandler(async (req, res) => {
  await findRing(req.params.ringId);
  const { status, note } = validateStatusBody(req.body);
  const o = setOverride('ring', req.params.ringId, status, note);
  res.json({ ringId: req.params.ringId, status: o.status, manualOverride: true, note: o.note, updatedAt: o.updatedAt });
}));

ringsRouter.delete('/:ringId/status', asyncHandler(async (req, res) => {
  await findRing(req.params.ringId);
  clearOverride('ring', req.params.ringId);
  res.json({ ringId: req.params.ringId, status: 'flagged', manualOverride: false });
}));

ringsRouter.post('/:ringId/brief', asyncHandler(async (req, res) => {
  await findRing(req.params.ringId);
  const brief = await provider.getBrief(req.params.ringId);
  if (!brief) throw notFound(`No brief for ring ${req.params.ringId}`);
  res.json(brief);
}));
