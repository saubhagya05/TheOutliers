import { Router } from 'express';
import { asyncHandler, badRequest } from '../lib/http.js';
import { provider } from '../providers/index.js';

export const stressRouter = Router();

stressRouter.get('/scenarios', asyncHandler(async (req, res) => {
  res.json(await provider.getStressScenarios());
}));

stressRouter.post('/', asyncHandler(async (req, res) => {
  const scenario = req.body && req.body.scenario;
  if (!scenario) throw badRequest('scenario is required');
  const result = await provider.runStressTest(scenario);
  if (!result) throw badRequest(`Unknown scenario ${scenario}`);
  res.json(result);
}));
