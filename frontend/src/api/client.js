// Every backend call in one place. Shapes are documented in docs/API.md.
// Owned by the backend lead: if you need a new call, ask, and it gets added here + in API.md.

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data && data.error ? data.error : { code: 'INTERNAL', message: `HTTP ${res.status}` };
    throw new ApiError(res.status, err.code, err.message);
  }
  return data;
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : String(v)]))}`;
};
const enc = encodeURIComponent;

// ---- General / Landing / Dataset (Dashboard owner) ----
export const getHealth = () => request('GET', '/health');
export const getOverview = () => request('GET', '/overview');
export const getBaseline = () => request('GET', '/baseline');
export const getDataset = () => request('GET', '/dataset');
export const getBenchmarks = () => request('GET', '/benchmarks');

// ---- Rings (Ring owner) ----
// params: { includeContext, contextNodes, minRisk, status: ['flagged','confirmed'] }
export const getRingsGraph = (params) => request('GET', `/rings/graph${qs(params)}`);
// params: { minRisk, level, status, district, sort: 'riskScore'|'priorityScore'|'amountAtRiskInr'|'memberCount', order, page, pageSize }
export const getRings = (params) => request('GET', `/rings${qs(params)}`);
export const getRing = (ringId) => request('GET', `/rings/${enc(ringId)}`);
// status: 'flagged' | 'confirmed' | 'deflagged'
export const setRingStatus = (ringId, status, note) => request('PUT', `/rings/${enc(ringId)}/status`, { status, note });
export const clearRingStatus = (ringId) => request('DELETE', `/rings/${enc(ringId)}/status`);
export const getRingBrief = (ringId) => request('POST', `/rings/${enc(ringId)}/brief`, {});
export const getStressScenarios = () => request('GET', '/stress-test/scenarios');
export const runStressTest = (scenario) => request('POST', '/stress-test', { scenario });

// ---- Lone + records (Lone owner; Ring owner uses the record calls for members) ----
// params: { includeNormal, normalSample, minRisk, status }
export const getLonePoints = (params) => request('GET', `/lone/points${qs(params)}`);
// params: { minRisk, level, status, district, signal, sort: 'riskScore'|'amountInr', order, page, pageSize }
export const getLone = (params) => request('GET', `/lone${qs(params)}`);
export const getRecord = (recordId) => request('GET', `/records/${enc(recordId)}`);
export const searchRecords = (q, limit = 10) => request('GET', `/records/search${qs({ q, limit })}`);
export const setRecordStatus = (recordId, status, note) => request('PUT', `/records/${enc(recordId)}/status`, { status, note });
export const clearRecordStatus = (recordId) => request('DELETE', `/records/${enc(recordId)}/status`);

// ---- Dataset choice (shown before the Ring / Lone pages)
export const getActiveDataset = () => request('GET', '/datasets/active');
export const useBuiltinDataset = () => request('POST', '/datasets/builtin', {});
// payload: { name, ledgerCsv, transfersCsv } (file contents as text). Resolves when detection has finished.
export const uploadDataset = (payload) => request('POST', '/datasets/upload', payload);
