// OWNER: Ring. Props: recordId, onClose(). Full record from GET /api/records/:recordId
// (features vs typical, all reasons, every field with anomalous ones in red).
import { getRecord } from '../../../api/client.js';
import { useApi } from '../../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../../components/States.jsx';
import RiskBadge from '../../../components/RiskBadge.jsx';
import { formatCell } from '../../../components/format.js';
import '../rings.css';

function FeatureBar({ f }) {
  const max = Math.max(Math.abs(f.value), Math.abs(f.typical), 1);
  const pct = (v) => `${Math.min(100, (Math.abs(v) / max) * 100)}%`;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
        <span style={{ color: f.anomalous ? 'var(--red)' : 'var(--text)' }}>{f.label}</span>
        <span className="mono muted">{f.value} <span style={{ color: 'var(--faint)' }}>vs</span> {f.typical}</span>
      </div>
      <div className="bar-track"><div className={`bar-fill ${f.anomalous ? '' : 'neutral'}`} style={{ width: pct(f.value) }} /></div>
      <div className="bar-track"><div className="bar-fill neutral" style={{ width: pct(f.typical), opacity: 0.4 }} /></div>
    </div>
  );
}

export default function RecordDrawer({ recordId, onClose }) {
  const rec = useApi(() => getRecord(recordId), [recordId]);
  const r = rec.data;
  const anomalous = new Map((r?.anomalies || []).map((a) => [a.field, a.label]));

  return (
    <div className="drawer">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 className="mono">{recordId}</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      {rec.loading && !r && <Loading label="Loading record" />}
      <ErrorBox error={rec.error} onRetry={rec.reload} />
      {r && (
        <div style={{ display: 'grid', gap: 18, marginTop: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>{r.fields.name} · <span className="muted">{r.kind} · {r.status}</span></span>
            <RiskBadge score={r.riskScore} level={r.riskLevel} />
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>Why flagged</div>
            {r.reasons.length ? (
              <div style={{ display: 'grid', gap: 6 }}>
                {r.reasons.map((x) => (
                  <div key={x.signal + x.label} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                    <span>{x.label}</span>
                    <span className="mono muted">{Math.round(x.weight * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : <span className="muted">No reasons recorded.</span>}
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>This record vs typical</div>
            <div style={{ display: 'grid', gap: 12 }}>{r.features.map((f) => <FeatureBar key={f.key} f={f} />)}</div>
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>All fields</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', fontSize: 13 }}>
              {r.columns.map((c) => (
                <FieldRow key={c.key} label={c.label} value={formatCell(r.fields[c.key], c.type)} why={anomalous.get(c.key)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, why }) {
  return (
    <>
      <span className="muted">{label}</span>
      <span title={why} style={why ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{value}</span>
    </>
  );
}
