// OWNER: Lone. Props: data = GET /api/lone response { columns, items, total }, signal, onSignalChange(signal),
// onSelect(recordId), onChanged() after a status change.
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import { setRecordStatus, clearRecordStatus } from '../../../api/client.js';

const SIGNALS = ['', 'instantWithdrawal', 'newAccount', 'oddHourApplication', 'registryMismatch', 'areaAnomaly'];

// TODO(lone): nicer filter chips with counts, risk level filter, toggle between table and card view.
export default function LoneList({ data, signal, onSignalChange, onSelect, onChanged }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">{data.total} lone ghosts</span>
        <select value={signal} onChange={(e) => onSignalChange(e.target.value)} className="btn">
          {SIGNALS.map((s) => <option key={s} value={s}>{s || 'All signals'}</option>)}
        </select>
      </div>
      <AnomalyTable
        columns={data.columns}
        rows={data.items}
        onRowClick={(row) => onSelect(row.recordId)}
        renderActions={(row) => (
          <StatusActions
            compact
            status={row.status}
            manualOverride={row.manualOverride}
            onSet={(s, note) => setRecordStatus(row.recordId, s, note)}
            onClear={() => clearRecordStatus(row.recordId)}
            onDone={onChanged}
          />
        )}
      />
    </div>
  );
}
