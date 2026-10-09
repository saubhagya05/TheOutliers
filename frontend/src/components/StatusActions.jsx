// Shared flag / confirm / deflag / undo buttons for a ring or a record.
// <StatusActions status={x.status} manualOverride={x.manualOverride}
//   onSet={(status, note) => setRingStatus(id, status, note)} onClear={() => clearRingStatus(id)} onDone={reload} />
import { useState } from 'react';

export default function StatusActions({ status, manualOverride, onSet, onClear, onDone, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone && onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (next) => {
    const note = compact ? null : window.prompt(`Note for "${next}" (optional)`) || null;
    return run(() => onSet(next, note));
  };

  return (
    <div className="row" style={{ gap: 6, flexWrap: compact ? 'nowrap' : 'wrap' }} onClick={(e) => e.stopPropagation()}>
      {status !== 'confirmed' && status !== 'notFlagged' && (
        <button className="btn" disabled={busy} onClick={() => set('confirmed')}>Confirm</button>
      )}
      {status !== 'deflagged' && status !== 'notFlagged' && (
        <button className="btn" disabled={busy} onClick={() => set('deflagged')}>Deflag</button>
      )}
      {status === 'notFlagged' && (
        <button className="btn btn-primary" disabled={busy} onClick={() => set('flagged')}>Flag</button>
      )}
      {manualOverride && (
        <button className="btn" disabled={busy} onClick={() => run(onClear)}>Undo</button>
      )}
      {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
    </div>
  );
}
