// Serves the generated mock audit with the same interface as mlProvider.
import { bundle, getRecord, searchRecords, buildBrief, stressScenarios, runStressTest } from '../mock/generate.js';
import { datasetInfo, benchmarks } from '../mock/static.js';

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
};
