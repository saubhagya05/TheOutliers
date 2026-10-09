// OWNER: Lone. Props: onSelect(recordId). GET /api/records/search?q=
// Lets the auditor find ANY record (even unflagged) to inspect or flag manually.
import { useState } from 'react';
import { searchRecords } from '../../../api/client.js';

// TODO(lone): debounce (300 ms), dropdown styling, keyboard navigation, show kind/status per result.
export default function RecordSearch({ onSelect }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);

  const onChange = async (value) => {
    setQ(value);
    if (value.trim().length < 2) return setItems([]);
    try {
      setItems((await searchRecords(value.trim(), 8)).items);
    } catch {
      setItems([]);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, record ID, phone…"
        className="btn"
        style={{ width: 280, cursor: 'text' }}
      />
      {items.length > 0 && (
        <div className="panel" style={{ position: 'absolute', right: 0, top: '110%', width: 320, zIndex: 20, padding: 6 }}>
          {items.map((i) => (
            <div key={i.recordId} style={{ padding: 6, cursor: 'pointer' }} onClick={() => { onSelect(i.recordId); setItems([]); }}>
              <span className="mono">{i.recordId}</span> {i.name} <span className="muted">· {i.district} · {i.kind} · {i.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
