// Talks to the FastAPI ML service (docs/API.md section 3). The audit bundle is fetched once and cached.
import { config } from '../config.js';
import { ApiError } from '../lib/http.js';

let cachedBundle = null;

async function ml(path, options = {}) {
  let res;
  try {
    res = await fetch(`${config.mlUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (err) {
    throw new ApiError(502, 'ML_UNAVAILABLE', `ML service unreachable: ${err.message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(502, 'ML_UNAVAILABLE', `ML service returned ${res.status} for ${path}`);
  return res.json();
}

async function auditId() {
  const h = await ml('/health');
  if (!h || !h.auditReady) throw new ApiError(502, 'ML_UNAVAILABLE', 'ML audit is not ready yet (POST /audit/run on the ML service)');
  return h.auditId;
}

export const mlProvider = {
  health: () => ml('/health'),
  async getBundle() {
    if (!cachedBundle) cachedBundle = await ml(`/audit/${await auditId()}/result`);
    return cachedBundle;
  },
  async getRecord(recordId) {
    return ml(`/audit/${await auditId()}/records/${encodeURIComponent(recordId)}`);
  },
  async searchRecords(q, limit) {
    return ml(`/audit/${await auditId()}/records/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
  async getBrief(ringId) {
    return ml(`/audit/${await auditId()}/rings/${encodeURIComponent(ringId)}/brief`, { method: 'POST', body: '{}' });
  },
  getStressScenarios: () => ml('/stress-test/scenarios'),
  async runStressTest(scenario) {
    return ml(`/audit/${await auditId()}/stress-test`, { method: 'POST', body: JSON.stringify({ scenario }) });
  },
  getDataset: () => ml('/dataset/info'),
  getBenchmarks: () => ml('/benchmarks'),
};
