// OWNER: Ring. Props: rings = GET /api/rings items, onSelect(ringId), onChanged() after a status change.
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import { formatInr } from '../../../components/format.js';
import { setRingStatus, clearRingStatus } from '../../../api/client.js';

// TODO(ring): filters (risk level, district, status), priority rank badge when sorted by priority,
// polish card design. Basic working version below.
export default function RingList({ rings, onSelect, onChanged }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="muted">{rings.length} rings</div>
      {rings.map((r) => (
        <div
          key={r.ringId}
          className="panel"
          onClick={() => onSelect(r.ringId)}
          style={{ cursor: 'pointer', borderLeft: `3px solid ${r.color}`, opacity: r.status === 'deflagged' ? 0.45 : 1 }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong style={{ color: r.color }}>{r.ringId}</strong>
            <RiskBadge score={r.riskScore} level={r.riskLevel} />
          </div>
          <div className="muted">
            {r.activeMemberCount} members · {formatInr(r.amountAtRiskInr)} · {r.district} · priority #{r.priority.rank} · {r.status}
          </div>
          <ReasonChips reasons={r.topReasons} />
          <div style={{ marginTop: 8 }}>
            <StatusActions
              status={r.status}
              manualOverride={r.manualOverride}
              onSet={(s, note) => setRingStatus(r.ringId, s, note)}
              onClear={() => clearRingStatus(r.ringId)}
              onDone={onChanged}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
