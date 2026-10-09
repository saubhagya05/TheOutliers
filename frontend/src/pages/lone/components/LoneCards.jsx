// OWNER: Lone. Right-column lists in the Ring page's card style.
// SignalCards: one card per signal (like rings). GhostCards: flagged records for one signal.
import { useState } from 'react';
import RiskBadge from '../../../components/RiskBadge.jsx';
import ReasonChips from '../../../components/ReasonChips.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import { Empty } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';
import { setRecordStatus, clearRecordStatus } from '../../../api/client.js';
import { LONE_SIGNALS, SIGNAL_BY_ID, signalsOf } from '../signals.js';
import '../../rings/rings.css';

export function SignalCards({ items, onSelect }) {
  const active = items.filter((i) => i.status !== 'deflagged');
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="section-label">{LONE_SIGNALS.length} signals · {active.length} flagged records</div>
      {LONE_SIGNALS.map((s) => {
        const hits = active.filter((i) => signalsOf(i).includes(s.id));
        const avg = hits.length ? Math.round(hits.reduce((t, i) => t + i.riskScore, 0) / hits.length) : 0;
        const amount = hits.reduce((t, i) => t + (i.fields.amountInr || 0), 0);
        return (
          <div key={s.id} className="ring-card" style={{ '--ring-color': s.color }} onClick={() => onSelect(s.id)}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong style={{ color: s.color, fontSize: 15 }}>{s.label}</strong>
              <span className="mono" style={{ fontSize: 20 }}>{hits.length}</span>
            </div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 6 }}>
              {formatInr(amount)} at risk · avg risk {avg}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.hint}</div>
          </div>
        );
      })}
    </div>
  );
}

export function GhostCards({ signal, items, onBack, onSelect, onChanged }) {
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('');
  const s = SIGNAL_BY_ID[signal];
  const all = items.filter((i) => signalsOf(i).includes(signal));
  const shown = all.filter((i) => (!level || i.riskLevel === level) && (!status || i.status === status));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button className="btn" onClick={onBack} style={{ justifySelf: 'start' }}>← All signals</button>
      <div>
        <h2 style={{ color: s.color }}>{s.label}</h2>
        <div className="muted" style={{ fontSize: 13 }}>{s.hint}</div>
      </div>
      <div className="filter-bar">
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Risk level">
          <option value="">All risk levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="flagged">Flagged</option>
          <option value="confirmed">Confirmed</option>
          <option value="deflagged">Deflagged</option>
        </select>
      </div>
      <div className="section-label">{shown.length} of {all.length} records</div>
      {!shown.length && <Empty label="No records match these filters" />}
      {shown.map((i) => (
        <div
          key={i.recordId}
          className={`ring-card ${i.status === 'deflagged' ? 'deflagged' : ''}`}
          style={{ '--ring-color': s.color }}
          onClick={() => onSelect(i.recordId)}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <strong>{i.fields.name}</strong> <span className="muted mono" style={{ fontSize: 12 }}>{i.recordId}</span>
            </div>
            <RiskBadge score={i.riskScore} level={i.riskLevel} />
          </div>
          <div className="muted mono" style={{ fontSize: 12, margin: '6px 0 8px' }}>
            {i.fields.district} · {formatInr(i.fields.amountInr)} · {i.status}{i.manualOverride ? ' · manual' : ''}
          </div>
          <ReasonChips reasons={i.topReasons} />
          <div style={{ marginTop: 10 }}>
            <StatusActions
              status={i.status}
              manualOverride={i.manualOverride}
              onSet={(st, note) => setRecordStatus(i.recordId, st, note)}
              onClear={() => clearRecordStatus(i.recordId)}
              onDone={onChanged}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
