// OWNER: Ring. Props: ring = GET /api/rings/:ringId response (null while loading), loading, error,
// onBack(), onChanged() after any status change.
import { useState } from 'react';
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import { ErrorBox, Loading } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';
import { setRingStatus, clearRingStatus, setRecordStatus, clearRecordStatus } from '../../../api/client.js';
import CaseBriefModal from './CaseBriefModal.jsx';
import RecordDrawer from './RecordDrawer.jsx';
import RingTimeline from './RingTimeline.jsx';
import '../rings.css';

export default function RingDetailPanel({ ring, loading, error, onBack, onChanged }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const [recordId, setRecordId] = useState(null);
  if (error) return <ErrorBox error={error} />;
  if (loading || !ring) return <Loading />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
      <button className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>← All rings</button>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ color: ring.color }}>{ring.ringId}</h2>
        <RiskBadge score={ring.riskScore} level={ring.riskLevel} />
      </div>
      <div className="muted">
        {ring.activeMemberCount}/{ring.memberCount} members · {formatInr(ring.amountAtRiskInr)} at risk · {ring.district} · status: {ring.status}
      </div>
      <p>{ring.summary}</p>
      <ReasonChips reasons={ring.reasons} max={6} />

      <div className="row">
        <StatusActions
          status={ring.status}
          manualOverride={ring.manualOverride}
          onSet={(s, note) => setRingStatus(ring.ringId, s, note)}
          onClear={() => clearRingStatus(ring.ringId)}
          onDone={onChanged}
        />
        <button className="btn btn-primary" onClick={() => setBriefOpen(true)}>Generate case brief</button>
      </div>

      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Signal breakdown</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {ring.signalBreakdown.map((s) => (
            <div key={s.signal} style={{ display: 'grid', gap: 4 }}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span>{s.label}</span>
                <span className="mono muted">{Math.round(s.value * 100)}</span>
              </div>
              <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(s.value * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Shared entities</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {ring.sharedEntities.map((e) => (
            <div key={e.id} className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', fontSize: 13 }}>
              <span><span className="muted">{e.type}</span> · {e.label}</span>
              <span className="mono" style={{ color: 'var(--red)' }}>{e.linkedMembers} members</span>
            </div>
          ))}
        </div>
      </div>

      <RingTimeline events={ring.timeline} />

      <div className="section-label">Members</div>
      {/* Red cells = anomalies. Deflag a member who was wrongly included; counts update via onChanged. */}
      <AnomalyTable
        onRowClick={(m) => setRecordId(m.recordId)}
        columns={ring.columns}
        rows={ring.members}
        renderActions={(m) => (
          <StatusActions
            compact
            status={m.status}
            manualOverride={m.manualOverride}
            onSet={(s, note) => setRecordStatus(m.recordId, s, note)}
            onClear={() => clearRecordStatus(m.recordId)}
            onDone={onChanged}
          />
        )}
      />
      {recordId && <RecordDrawer recordId={recordId} onClose={() => setRecordId(null)} />}

      {briefOpen && <CaseBriefModal ringId={ring.ringId} onClose={() => setBriefOpen(false)} />}
    </div>
  );
}
