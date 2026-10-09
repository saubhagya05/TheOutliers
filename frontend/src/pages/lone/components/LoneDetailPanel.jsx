// OWNER: Lone. Props: record = GET /api/records/:recordId response (null while loading), loading, error,
// onBack(), onChanged() after a status change. Works for flagged AND unflagged records (manual flag).
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import { ErrorBox, Loading, Todo } from '../../../components/States.jsx';
import { setRecordStatus, clearRecordStatus } from '../../../api/client.js';

export default function LoneDetailPanel({ record, loading, error, onBack, onChanged }) {
  if (error) return <ErrorBox error={error} />;
  if (loading || !record) return <Loading />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <button className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>← All lone ghosts</button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{record.fields.name} <span className="muted mono" style={{ fontSize: 14 }}>{record.recordId}</span></h2>
        <RiskBadge score={record.riskScore} level={record.riskLevel} />
      </div>
      <div className="muted">kind: {record.kind}{record.ringId ? ` (ring ${record.ringId})` : ''} · status: {record.status}</div>
      <ReasonChips reasons={record.reasons} max={6} />

      <StatusActions
        status={record.status}
        manualOverride={record.manualOverride}
        onSet={(s, note) => setRecordStatus(record.recordId, s, note)}
        onClear={() => clearRecordStatus(record.recordId)}
        onDone={onChanged}
      />

      <Todo name="FeatureBars">
        {record.features.map((f) => `${f.label}: ${f.value} (typical ${f.typical})${f.anomalous ? '  <- RED' : ''}`).join('\n')}
        {'\nRender as horizontal bars: this record vs dataset typical, anomalous ones in red.'}
      </Todo>

      {/* All fields in one row, anomalous cells in red. TODO(lone): vertical key/value layout may read better here. */}
      <AnomalyTable columns={record.columns} rows={[record]} />
    </div>
  );
}
