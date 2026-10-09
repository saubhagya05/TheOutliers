// OWNER: Ring. Props: rings = GET /api/rings items, onSelect(ringId), onChanged() after a status change,
// prioritised (bool) = list is sorted by priorityScore, so show the rank badge.
import { useMemo, useState } from 'react';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import { Empty } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';
import { setRingStatus, clearRingStatus } from '../../../api/client.js';
import '../rings.css';

export default function RingList({ rings, onSelect, onChanged, prioritised = false }) {
  const [level, setLevel] = useState('');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState('');

  const districts = useMemo(() => [...new Set(rings.map((r) => r.district))].sort(), [rings]);
  const shown = rings.filter(
    (r) => (!level || r.riskLevel === level) && (!district || r.district === district) && (!status || r.status === status),
  );

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="filter-bar">
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Risk level">
          <option value="">All risk levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={district} onChange={(e) => setDistrict(e.target.value)} aria-label="District">
          <option value="">All districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="flagged">Flagged</option>
          <option value="confirmed">Confirmed</option>
          <option value="deflagged">Deflagged</option>
        </select>
      </div>
      <div className="section-label">{shown.length} of {rings.length} rings{prioritised ? ' · by priority' : ''}</div>

      {!shown.length && <Empty label="No rings match these filters" />}

      {shown.map((r) => (
        <div
          key={r.ringId}
          className={`ring-card ${r.status === 'deflagged' ? 'deflagged' : ''}`}
          style={{ '--ring-color': r.color }}
          onClick={() => onSelect(r.ringId)}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 10 }}>
              {prioritised && <span className="rank-badge">#{r.priority.rank}</span>}
              <strong className="mono" style={{ color: r.color, fontSize: 16 }}>{r.ringId}</strong>
            </div>
            <RiskBadge score={r.riskScore} level={r.riskLevel} />
          </div>
          <div className="muted mono" style={{ fontSize: 12, margin: '6px 0 8px' }}>
            {r.activeMemberCount} members · {formatInr(r.amountAtRiskInr)} · {r.district} · {r.status}
            {prioritised && ` · effort ${r.priority.effort}`}
          </div>
          <ReasonChips reasons={r.topReasons} />
          <div style={{ marginTop: 10 }}>
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
