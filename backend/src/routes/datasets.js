import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http.js';
import { provider } from '../providers/index.js';
import { clearAllOverrides } from '../services/overrides.js';

export const datasetsRouter = Router();

datasetsRouter.get('/active', asyncHandler(async (req, res) => {
  res.json(await provider.getActiveDataset());
}));

// Both POSTs return once detection has finished, so the frontend can go straight to the results.
datasetsRouter.post('/builtin', asyncHandler(async (req, res) => {
  const out = await provider.useBuiltinDataset();
  clearAllOverrides();
  res.json(out);
}));

datasetsRouter.post('/upload', asyncHandler(async (req, res) => {
  const { name, ledgerCsv, transfersCsv } = req.body || {};
  if (typeof ledgerCsv !== 'string' || !ledgerCsv.trim()) throw badRequest('ledgerCsv (the ledger file contents) is required');
  const out = await provider.uploadDataset({ name, ledgerCsv, transfersCsv: typeof transfersCsv === 'string' ? transfersCsv : '' });
  clearAllOverrides();   // flags / deflags belong to the previous dataset's records
  res.json(out);
}));
