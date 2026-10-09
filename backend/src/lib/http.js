export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg) => new ApiError(400, 'BAD_REQUEST', msg);
export const notFound = (msg) => new ApiError(404, 'NOT_FOUND', msg);

// Lets route handlers be async without try/catch everywhere.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: { code, message: err.message || 'Internal error' } });
}

export function riskLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function parseList(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

export function parseIntIn(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// get(item) returns the value to sort by.
export function sortItems(items, get, order = 'desc') {
  const dir = order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === vb) return 0;
    return va > vb ? dir : -dir;
  });
}

export function paginate(items, query) {
  const page = parseIntIn(query.page, 1, 1, 100000);
  const pageSize = parseIntIn(query.pageSize, 20, 1, 100);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length };
}
