
import { useMemo } from 'react';
import AnomalyTable from '../../../components/AnomalyTable.jsx';
import StatusActions from '../../../components/StatusActions.jsx';
import {
  setRecordStatus,
  clearRecordStatus,
} from '../../../api/client.js';

const SIGNALS = [
  { value: '', label: 'All signals' },
  { value: 'invalidAadhaar', label: 'Invalid Aadhaar' },
  { value: 'expiredAadhaar', label: 'Expired Aadhaar' },
  { value: 'invalidPhone', label: 'Invalid phone' },
  { value: 'duplicatePhone', label: 'Duplicate phone' },
  { value: 'loginBruteforce', label: 'Login brute force' },
  { value: 'oddHourRegistration', label: 'Odd-hour registration' },
];

const LEVELS = [
  { value: '', label: 'All risks' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function LoneList({
  data,
  signal,
  onSignalChange,
  level,
  onLevelChange,
  onSelect,
  onChanged,
}) {
  const items = data?.items ?? [];

  // Count each signal among the records currently returned by the API.
  const signalCounts = useMemo(() => {
    const counts = { '': items.length };

    for (const item of items) {
      const seenSignals = new Set(
        (item.anomalies ?? []).map((anomaly) => anomaly.signal)
      );

      for (const signalName of seenSignals) {
        counts[signalName] = (counts[signalName] ?? 0) + 1;
      }
    }

    return counts;
  }, [items]);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section>
        <div className="muted" style={{ marginBottom: 8 }}>
          Filter by signal
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {SIGNALS.map((option) => {
            const active = signal === option.value;
            const count = signalCounts[option.value] ?? 0;

            return (
              <button
                key={option.value || 'all-signals'}
                type="button"
                className="btn"
                aria-pressed={active}
                onClick={() => onSignalChange(option.value)}
                style={{
                  borderColor: active ? 'var(--red)' : undefined,
                  background: active ? 'var(--panel)' : undefined,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="muted" style={{ marginBottom: 8 }}>
          Filter by risk level
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LEVELS.map((option) => {
            const active = level === option.value;

            return (
              <button
                key={option.value || 'all-risks'}
                type="button"
                className="btn"
                aria-pressed={active}
                onClick={() => onLevelChange(option.value)}
                style={{
                  borderColor: active ? 'var(--red)' : undefined,
                  background: active ? 'var(--panel)' : undefined,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="muted">
        Showing {items.length} records
        {data?.total != null ? ` of ${data.total}` : ''}
      </div>

      {items.length === 0 ? (
        <div className="muted" style={{ padding: 16 }}>
          No records match the selected filters. Try another signal or risk level.
        </div>
      ) : (
        <AnomalyTable
          columns={data?.columns ?? []}
          rows={items}
          onRowClick={(row) => onSelect(row.recordId)}
          renderActions={(row) => (
            <StatusActions
              compact
              status={row.status}
              manualOverride={row.manualOverride}
              onSet={(status, note) =>
                setRecordStatus(row.recordId, status, note)
              }
              onClear={() => clearRecordStatus(row.recordId)}
              onDone={onChanged}
            />
          )}
        />
      )}
    </div>
  );
}
