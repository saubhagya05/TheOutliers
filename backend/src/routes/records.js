import { Router } from 'express';
import { asyncHandler, badRequest, notFound, parseIntIn } from '../lib/http.js';
import { provider } from '../providers/index.js';
import { setOverride, clearOverride } from '../services/overrides.js';
import { recordState, defaultStatusForKind } from '../services/views.js';
import { validateStatusBody } from './rings.js';

export const recordsRouter = Router();

async function findRecord(recordId) {
  const record = await provider.getRecord(recordId);
  if (!record) throw notFound(`Record ${recordId} does not exist`);
  return record;
}

// Must be registered before /:recordId.
recordsRouter.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw badRequest('q must be at least 2 characters');
  const limit = parseIntIn(req.query.limit, 10, 1, 50);
  const { items } = await provider.searchRecords(q, limit);
  res.json({ items: items.map((i) => ({ ...i, status: recordState(i.recordId, defaultStatusForKind(i.kind)).status })) });
}));

recordsRouter.get('/:recordId', asyncHandler(async (req, res) => {
  const record = await findRecord(req.params.recordId);
  res.json({ ...record, ...recordState(record.recordId, defaultStatusForKind(record.kind)) });
}));

recordsRouter.put('/:recordId/status', asyncHandler(async (req, res) => {
  const record = await findRecord(req.params.recordId);
  const { status, note } = validateStatusBody(req.body);
  const o = setOverride('record', record.recordId, status, note, record);
  res.json({ recordId: record.recordId, status: o.status, manualOverride: true, note: o.note, updatedAt: o.updatedAt });
}));

recordsRouter.delete('/:recordId/status', asyncHandler(async (req, res) => {
  const record = await findRecord(req.params.recordId);
  clearOverride('record', record.recordId);
  res.json({ recordId: record.recordId, status: defaultStatusForKind(record.kind), manualOverride: false });
}));
