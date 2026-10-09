// Formatting helpers shared by every page.

export function formatInr(n) {
  if (n === null || n === undefined) return '–';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Formats a table cell by the API column type (docs/API.md "Column").
export function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return '–';
  switch (type) {
    case 'inr': return formatInr(value);
    case 'datetime': return formatDateTime(value);
    case 'boolean': return value ? 'Yes' : 'No';
    default: return String(value);
  }
}
