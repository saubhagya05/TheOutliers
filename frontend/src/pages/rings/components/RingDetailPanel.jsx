// OWNER: Ring. Props: ring = GET /api/rings/:ringId response (null while loading), loading, error,
// onBack(), onChanged() after any status change.
import { useState } from 'react';
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import { ErrorBox, Loading, Todo } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';
import { setRingStatus, clearRingStatus, setRecordStatus, clearRecordStatus } from '../../../api/client.js';
import CaseBriefModal from './CaseBriefModal.jsx';

export default function RingDetailPanel({ ring, loading, error, onBack, onChanged }) {
  const [briefOpen, setBriefOpen] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (loading || !ring) return <Loading />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
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

      <Todo name="SignalBreakdown + SharedEntities + Timeline">
        {`signalBreakdown: ${ring.signalBreakdown.length} bars (label, value 0-1)
sharedEntities: ${ring.sharedEntities.map((e) => `${e.label} (${e.linkedMembers})`).join(', ')}
timeline: ${ring.timeline.length} events (application / payout / withdrawal). Cut first if short on time.`}
      </Todo>

      <h3>Members</h3>
      {/* Red cells = anomalies. Deflag a member who was wrongly included; counts update via onChanged. */}
      <AnomalyTable
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
      {/* TODO(ring): row click -> drawer with GET /api/records/:recordId (features vs typical, all reasons) */}

      {briefOpen && <CaseBriefModal ringId={ring.ringId} onClose={() => setBriefOpen(false)} />}
    </div>
  );
}
