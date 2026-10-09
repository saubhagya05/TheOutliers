// OWNER: Lone. Props: record = GET /api/records/:recordId (null while loading), loading, error, color,
// backLabel, onBack(), onChanged(). Same layout as the Ring page's RingDetailPanel.
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import { ErrorBox, Loading } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';
import { setRecordStatus, clearRecordStatus } from '../../../api/client.js';
import '../../rings/rings.css';

export default function LoneDetailPanel({ record, loading, error, color, backLabel = '← Back', onBack, onChanged }) {
  if (error) return <ErrorBox error={error} />;
  if (loading || !record) return <Loading />;
  const f = record.fields;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      <button className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>{backLabel}</button>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ color: color || 'var(--text)' }}>{f.name}</h2>
        <RiskBadge score={record.riskScore} level={record.riskLevel} />
      </div>
      <div className="muted mono" style={{ fontSize: 12 }}>
        {record.recordId} · {f.district} · {formatInr(f.amountInr)} · {record.kind === 'ringMember' ? `ring ${record.ringId}` : record.kind} · status: {record.status}
      </div>
      <ReasonChips reasons={record.reasons} max={6} />

      <div className="row">
        <StatusActions
          status={record.status}
          manualOverride={record.manualOverride}
          onSet={(s, note) => setRecordStatus(record.recordId, s, note)}
          onClear={() => clearRecordStatus(record.recordId)}
          onDone={onChanged}
        />
      </div>

      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Evidence vs typical record</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {record.features.map((x) => {
            const scale = Math.max(x.value, x.typical * 2, 1);
            return (
              <div key={x.key} style={{ display: 'grid', gap: 4 }}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{x.label}</span>
                  <span className="mono" style={{ color: x.anomalous ? 'var(--red)' : 'var(--muted)' }}>
                    {x.value} <span className="muted">· typical {x.typical}</span>
                  </span>
                </div>
                <div className="bar-track">
                  <div className={`bar-fill ${x.anomalous ? '' : 'neutral'}`} style={{ width: `${Math.round((x.value / scale) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-label">Record</div>
      {/* Red cells = the fields that triggered a signal. */}
      <AnomalyTable columns={record.columns.map((c) => ({ ...c, default: ['name', 'aadhaarMasked', 'aadhaarStatus', 'phoneMasked', 'registrationAt', 'loginFailed', 'loginWindowMinutes', 'bankAccount', 'amountInr'].includes(c.key) }))} rows={[record]} />
    </div>
  );
}
