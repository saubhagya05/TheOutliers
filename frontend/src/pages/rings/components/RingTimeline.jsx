// OWNER: Ring. STAR. Props: events = ring.timeline [{ at, event: application|payout|withdrawal, recordId, amountInr? }]
// Dots on a time axis, one lane per event type, so bursts show up as vertical clusters.
import { formatDateTime } from '../../../components/format.js';

const LANES = [
  { key: 'application', label: 'Applied' },
  { key: 'payout', label: 'Paid out' },
  { key: 'withdrawal', label: 'Withdrawn' },
];

export default function RingTimeline({ events = [] }) {
  if (!events.length) return null;
  const times = events.map((e) => new Date(e.at).getTime());
  const min = Math.min(...times);
  const span = Math.max(Math.max(...times) - min, 1);
  return (
    <div>
      <div className="section-label" style={{ marginBottom: 6 }}>Timeline</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {LANES.map((l) => (
          <div key={l.key} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', gap: 8 }}>
            <span className="muted" style={{ fontSize: 11 }}>{l.label}</span>
            <div style={{ position: 'relative', height: 14, borderBottom: '1px solid var(--border)' }}>
              {events.filter((e) => e.event === l.key).map((e, i) => (
                <span
                  key={i}
                  title={`${e.recordId} · ${e.event} · ${formatDateTime(e.at)}`}
                  style={{
                    position: 'absolute', top: 3, width: 6, height: 6, borderRadius: '50%',
                    left: `calc(${((new Date(e.at).getTime() - min) / span) * 100}% - 3px)`,
                    background: 'var(--red)', opacity: 0.75, boxShadow: 'var(--red-glow)',
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="row mono muted" style={{ justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
        <span>{formatDateTime(new Date(min).toISOString())}</span>
        <span>{formatDateTime(new Date(min + span).toISOString())}</span>
      </div>
    </div>
  );
}
