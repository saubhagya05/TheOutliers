// OWNER: Ring. BaselineToggle props: on (bool), onChange(bool).
// BaselineOverlay props: baseline = GET /api/baseline response (shown over the graph when the toggle is on).
import { formatInr } from '../../../components/format.js';
import '../rings.css';

export default function BaselineToggle({ on, onChange }) {
  return (
    <button className={`btn ${on ? 'btn-active' : ''}`} onClick={() => onChange(!on)}>
      {on ? 'Showing: unique-ID check' : 'Compare with unique-ID check'}
    </button>
  );
}

function Column({ title, method, rings, records, amount, accent }) {
  return (
    <div>
      <div className="section-label">{title}</div>
      <div className="mono" style={{ fontSize: 34, lineHeight: 1.1, margin: '6px 0', color: accent ? 'var(--red)' : 'var(--muted)' }}>
        {rings} <span style={{ fontSize: 13 }}>rings</span>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>{method}</div>
      <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>{records} records · {formatInr(amount)}</div>
    </div>
  );
}

export function BaselineOverlay({ baseline }) {
  if (!baseline) return null;
  const { baseline: b, ours: o } = baseline;
  return (
    <div className="graph-overlay">
      <Column title="What a unique-ID check sees" method={b.method} rings={b.ringsDetected} records={b.recordsFlagged} amount={b.amountCaughtInr} />
      <Column title="What our graph sees" method={o.method} rings={o.ringsDetected} records={o.recordsFlagged} amount={o.amountCaughtInr} accent />
      <div style={{ gridColumn: '1 / -1', fontSize: 13 }}>{baseline.headline}</div>
    </div>
  );
}
