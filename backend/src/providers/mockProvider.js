// Serves the oracle bundle + real ledger with the same interface as mlProvider.
import { bundle, datasetInfo, getRecord, searchRecords, buildBrief, stressScenarios, runStressTest } from '../mock/data.js';
import { benchmarks } from '../mock/static.js';
import { ApiError } from '../lib/http.js';

export const mockProvider = {
  async health() {
    return { status: 'ok', auditReady: true, auditId: bundle.auditId };
  },
  async getBundle() {
    return bundle;
  },
  async getRecord(recordId) {
    return getRecord(recordId);
  },
  async searchRecords(q, limit) {
    return { items: searchRecords(q, limit) };
  },
  async getBrief(ringId) {
    const ring = bundle.rings.find((r) => r.ringId === ringId);
    return ring ? buildBrief(ring) : null;
  },
  async getStressScenarios() {
    return { scenarios: stressScenarios.map(({ lost, ...s }) => s) };
  },
  async runStressTest(scenario) {
    return runStressTest(scenario);
  },
  async getDataset() {
    return datasetInfo;
  },
  async getBenchmarks() {
    return benchmarks;
  },

  // ---- dataset choice: mock mode only has our dataset; uploads need the ML service.
  async getActiveDataset() {
    return { dataset: builtinDataset(), status: 'done', error: null, canUpload: false };
  },
  async useBuiltinDataset() {
    return { dataset: builtinDataset(), status: 'done' };
  },
  async uploadDataset() {
    throw new ApiError(400, 'BAD_REQUEST', 'Uploading needs the ML service: start it and set MOCK=false in backend/.env.');
  },
};

function builtinDataset() {
  const p = datasetInfo.planted;
  return {
    id: 'builtin', source: 'builtin', name: datasetInfo.name,
    recordCount: datasetInfo.recordCount, transferCount: datasetInfo.transferCount,
    description: `${datasetInfo.recordCount.toLocaleString('en-IN')} simulated scholarship beneficiaries and `
      + `${(datasetInfo.transferCount || 0).toLocaleString('en-IN')} money transfers, with ${p.rings} planted fraud rings `
      + `and ${p.loneGhosts} lone ghosts whose answers we know.`,
  };
}
