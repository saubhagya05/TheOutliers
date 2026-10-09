import { Router } from 'express';
import { asyncHandler, paginate, parseIntIn, parseList, sortItems } from '../lib/http.js';
import { provider } from '../providers/index.js';
import { loneViews, pointViews } from '../services/views.js';

export const loneRouter = Router();

const ALL_STATUSES = ['flagged', 'confirmed', 'deflagged'];
const LONE_SORTS = {
  riskScore: (r) => r.riskScore,
  amountInr: (r) => r.fields.amountInr || 0,
};

// Must be registered before any /:id route.
loneRouter.get('/points', asyncHandler(async (req, res) => {
  const q = req.query;
  const minRisk = parseIntIn(q.minRisk, 0, 0, 100);
  const statuses = parseList(q.status, null);
  const normalSample = parseIntIn(q.normalSample, 600, 0, 3000);
  const includeNormal = q.includeNormal !== 'false';

  const all = await pointViews();
  const highlighted = all.filter((p) => p.flagged || p.status === 'deflagged');
  const normal = includeNormal ? all.filter((p) => !p.flagged && p.status !== 'deflagged').slice(0, normalSample) : [];
  const points = [...normal, ...highlighted]
    .filter((p) => p.riskScore >= minRisk || !p.flagged)
    .filter((p) => !statuses || statuses.includes(p.status));
  res.json({ points, axes: { x: 'Behaviour projection 1', y: 'Behaviour projection 2' } });
}));

loneRouter.get('/', asyncHandler(async (req, res) => {
  const q = req.query;
  const statuses = parseList(q.status, ALL_STATUSES);
  const minRisk = parseIntIn(q.minRisk, 0, 0, 100);
  const sortKey = LONE_SORTS[q.sort] ? q.sort : 'riskScore';
  let items = (await loneViews())
    .filter((r) => statuses.includes(r.status))
    .filter((r) => r.riskScore >= minRisk)
    .filter((r) => !q.level || r.riskLevel === q.level)
    .filter((r) => !q.district || String(r.fields.district).toLowerCase() === String(q.district).toLowerCase())
    .filter((r) => !q.signal || r.anomalies.some((a) => a.signal === q.signal));
  items = sortItems(items, LONE_SORTS[sortKey], q.order === 'asc' ? 'asc' : 'desc');
  const bundle = await provider.getBundle();
  res.json({ columns: bundle.loneColumns, ...paginate(items, q) });
}));
