// Talks to the FastAPI ML service (docs/API.md section 3). The audit bundle is cached per audit id,
// so switching or uploading a dataset (a new audit) is picked up automatically.
import { config } from '../config.js';
import { ApiError } from '../lib/http.js';

let cache = { auditId: null, bundle: null };
const AUDIT_TIMEOUT_MS = 5 * 60 * 1000;

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
  if (res.status === 400) {
    // Validation errors (e.g. missing columns in an upload) go straight to the user.
    const body = await res.json().catch(() => null);
    const detail = body && body.detail;
    throw new ApiError(400, 'BAD_REQUEST', (detail && detail.message) || 'The ML service rejected the request');
  }
  if (!res.ok) throw new ApiError(502, 'ML_UNAVAILABLE', `ML service returned ${res.status} for ${path}`);
  return res.json();
}

async function auditId() {
  const h = await ml('/health');
  if (!h || !h.auditReady) {
    const why = h && h.auditStatus === 'failed' ? `ML audit failed: ${h.error}` : 'ML audit is still running, try again in a few seconds';
    throw new ApiError(502, 'ML_UNAVAILABLE', why);
  }
  return h.auditId;
}

// Wait until the audit started for `id` finishes (uploads take a few seconds per 10,000 records).
async function waitForAudit(id) {
  const started = Date.now();
  while (Date.now() - started < AUDIT_TIMEOUT_MS) {
    const h = await ml('/health');
    if (h && h.auditId !== id) throw new ApiError(409, 'CONFLICT', 'Another dataset was selected while this one was being analysed');
    if (h && h.auditStatus === 'failed') throw new ApiError(400, 'BAD_REQUEST', `Detection failed on this dataset: ${h.error}`);
    if (h && h.auditReady) return h;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new ApiError(504, 'ML_TIMEOUT', 'Detection took too long on this dataset');
}

export const mlProvider = {
  health: () => ml('/health'),
  async getBundle() {
    const id = await auditId();
    if (cache.auditId !== id) cache = { auditId: id, bundle: await ml(`/audit/${id}/result`) };
    return cache.bundle;
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

  // ---- dataset choice (returns once detection has finished on the chosen data)
  async getActiveDataset() {
    const a = await ml('/datasets/active');
    return { dataset: a.dataset, status: a.status, error: a.error, canUpload: true };
  },
  async useBuiltinDataset() {
    const started = await ml('/datasets/builtin', { method: 'POST', body: '{}' });
    await waitForAudit(started.auditId);
    return { dataset: started.dataset, status: 'done' };
  },
  async uploadDataset(payload) {
    const started = await ml('/datasets/upload', { method: 'POST', body: JSON.stringify(payload) });
    await waitForAudit(started.auditId);
    return { dataset: started.dataset, status: 'done' };
  },
};
