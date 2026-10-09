// Shared SQL-style table with red anomaly cells. Used by the Ring member table and the Lone table.
// <AnomalyTable columns={ring.columns} rows={ring.members} selectedId={id} onRowClick={(row) => ...}
//   renderActions={(row) => <StatusActions ... />} />
// rows use the "Record row" shape (docs/API.md 1.1): { recordId, fields, anomalies, status, ... }
import { useState } from 'react';
import { formatCell } from './format.js';

export default function AnomalyTable({ columns = [], rows = [], selectedId, onRowClick, renderActions }) {
  const [showAll, setShowAll] = useState(false);
  const visible = columns.filter((c) => showAll || c.default);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Fewer columns' : `More columns (${columns.length - columns.filter((c) => c.default).length})`}
        </button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Record</th>
              {visible.map((c) => <th key={c.key}>{c.label}</th>)}
              {renderActions && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const byField = new Map();
              for (const a of row.anomalies || []) byField.set(a.field, [...(byField.get(a.field) || []), a.label]);
              return (
                <tr
                  key={row.recordId}
                  className={row.status === 'deflagged' ? 'deflagged' : ''}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', outline: row.recordId === selectedId ? '1px solid var(--red)' : 'none' }}
                >
                  <td className="mono">{row.recordId}</td>
                  {visible.map((c) => {
                    const labels = byField.get(c.key);
                    return (
                      <td key={c.key} className={labels ? 'anomaly' : ''} title={labels ? labels.join('\n') : undefined}>
                        {formatCell(row.fields[c.key], c.type)}
                      </td>
                    );
                  })}
                  {renderActions && <td>{renderActions(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
