import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { config } from '../config.js';
import { provider } from '../providers/index.js';
import { reviewedCounts } from '../services/overrides.js';
import { ringViews, loneViews } from '../services/views.js';

export const generalRouter = Router();

async function mlStatus() {
  try {
    const res = await fetch(`${config.mlUrl}/health`, { signal: AbortSignal.timeout(1000) });
    return res.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

generalRouter.get('/health', asyncHandler(async (req, res) => {
  res.json({ status: 'ok', mode: config.mock ? 'mock' : 'live', ml: await mlStatus(), time: new Date().toISOString() });
}));

generalRouter.get('/overview', asyncHandler(async (req, res) => {
  const bundle = await provider.getBundle();
  // Low-risk rings stay visible on the Ring page but are not counted as "found".
  const rings = (await ringViews()).filter((r) => r.status !== 'deflagged' && r.riskScore >= 40);
  const lone = (await loneViews()).filter((r) => r.status !== 'deflagged');
  const ringAtRiskInr = rings.reduce((s, r) => s + r.amountAtRiskInr, 0);
  const loneAtRiskInr = lone.reduce((s, r) => s + (r.fields.amountInr || 0), 0);
  res.json({
    datasetName: bundle.datasetName,
    recordsScanned: bundle.recordsScanned,
    ringsFound: rings.length,
    ringMembers: rings.reduce((s, r) => s + r.activeMemberCount, 0),
    loneGhostsFound: lone.length,
    totalAtRiskInr: ringAtRiskInr + loneAtRiskInr,
    ringAtRiskInr,
    loneAtRiskInr,
    reviewed: reviewedCounts(),
    lastAuditAt: bundle.finishedAt,
  });
}));

generalRouter.get('/baseline', asyncHandler(async (req, res) => {
  res.json((await provider.getBundle()).baseline);
}));

generalRouter.get('/dataset', asyncHandler(async (req, res) => {
  res.json(await provider.getDataset());
}));

generalRouter.get('/benchmarks', asyncHandler(async (req, res) => {
  res.json(await provider.getBenchmarks());
}));
