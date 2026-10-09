// Shared. <ReasonChips reasons={ring.topReasons} />  (Reason shape: docs/API.md 1.1)
export default function ReasonChips({ reasons = [], max = 3 }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {reasons.slice(0, max).map((r) => (
        <span key={r.signal + r.label} title={r.label} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'var(--red-soft)', color: 'var(--text)' }}>
          {r.label}
        </span>
      ))}
    </div>
  );
}
