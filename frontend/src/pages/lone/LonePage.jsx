
import { useMemo, useState } from 'react';
import { getLonePoints, getLone, getRecord } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import PointCloud from './components/PointCloud.jsx';
import LoneList from './components/LoneList.jsx';
import LoneDetailPanel from './components/LoneDetailPanel.jsx';
import RecordSearch from './components/RecordSearch.jsx';
import './LonePage.css';

const SIGNALS = [
  { value: 'instantWithdrawal', label: 'Instant withdrawal' },
  { value: 'newAccount', label: 'New account' },
  { value: 'oddHourApplication', label: 'Odd-hour application' },
  { value: 'registryMismatch', label: 'Registry mismatch' },
  { value: 'areaAnomaly', label: 'Area anomaly' },
];

const RISK_COLORS = {
  high: 'var(--red, #ff454f)',
  medium: 'var(--orange, #ff8a35)',
  low: 'var(--yellow, #f4c84a)',
  normal: 'var(--blue, #83a9d6)',
};

function getRiskCounts(items = []) {
  return items.reduce(
    (counts, item) => {
      const risk = String(item.riskLevel ?? 'low').toLowerCase();
      if (Object.hasOwn(counts, risk)) counts[risk] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

function getSignalCounts(items = []) {
  const counts = Object.fromEntries(SIGNALS.map((s) => [s.value, 0]));

  for (const item of items) {
    const seen = new Set(
      (item.anomalies ?? [])
        .map((anomaly) => anomaly.signal)
        .filter(Boolean)
    );

    if (item.topSignal) seen.add(item.topSignal);

    for (const signal of seen) {
      if (signal in counts) counts[signal] += 1;
    }
  }

  return counts;
}

function RiskDistribution({ counts }) {
  const total = counts.high + counts.medium + counts.low;
  const highEnd = total ? (counts.high / total) * 100 : 0;
  const mediumEnd = total
    ? highEnd + (counts.medium / total) * 100
    : 0;

  return (
    <div className="lone-chart-card">
      <h3>Risk level distribution</h3>
      <div className="lone-risk-chart">
        <div
          className="lone-donut"
          style={{
            background: `conic-gradient(
              ${RISK_COLORS.high} 0% ${highEnd}%,
              ${RISK_COLORS.medium} ${highEnd}% ${mediumEnd}%,
              ${RISK_COLORS.low} ${mediumEnd}% 100%
            )`,
          }}
          role="img"
          aria-label={`Risk distribution across ${total} loaded records`}
        >
          <div className="lone-donut-hole">
            <strong>{total}</strong>
            <span>Loaded</span>
          </div>
        </div>

        <div className="lone-chart-legend">
          {['high', 'medium', 'low'].map((risk) => (
            <div className="lone-legend-row" key={risk}>
              <span
                className="lone-legend-dot"
                style={{ background: RISK_COLORS[risk] }}
              />
              <span>{risk[0].toUpperCase() + risk.slice(1)} risk</span>
              <strong>{counts[risk]}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="lone-chart-note">
        Counts are based on records currently returned by the API.
      </p>
    </div>
  );
}

function SignalSummary({ counts }) {
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <div className="lone-chart-card">
      <h3>Top anomaly signals</h3>
      <div className="lone-signal-bars">
        {SIGNALS.map((signal, index) => {
          const count = counts[signal.value] ?? 0;
          const colors = [
            RISK_COLORS.high,
            RISK_COLORS.medium,
            RISK_COLORS.low,
            'var(--orange, #ffb547)',
            RISK_COLORS.normal,
          ];

          return (
            <div className="lone-signal-row" key={signal.value}>
              <span title={signal.label}>{signal.label}</span>
              <div className="lone-bar-track">
                <div
                  className="lone-bar"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: colors[index],
                  }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
      <p className="lone-chart-note">
        Each record is counted once per signal in the loaded results.
      </p>
    </div>
  );
}

function ExpandableTab({ id, activeTab, onToggle, icon, title, children }) {
  const open = activeTab === id;

  return (
    <section className={`lone-expandable ${open ? 'is-open' : ''}`}>
      <button
        className="lone-expandable-trigger"
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(open ? null : id)}
      >
        <span className="lone-expandable-title">
          <span className="lone-expandable-icon">{icon}</span>
          {title}
        </span>
        <span className={`lone-chevron ${open ? 'is-open' : ''}`}>
          ⌄
        </span>
      </button>

      {open && <div className="lone-expandable-content">{children}</div>}
    </section>
  );
}

export default function LonePage() {
  const [selectedId, setSelectedId] = useState(null);
  const [signal, setSignal] = useState('');
  const [level, setLevel] = useState('');
  const [activeTab, setActiveTab] = useState(null);

  const points = useApi(
    () => getLonePoints({ includeNormal: true, normalSample: 600 }),
    []
  );

  const lone = useApi(
    () => getLone({ pageSize: 100, signal, level }),
    [signal, level]
  );

  const detail = useApi(
    () => (selectedId ? getRecord(selectedId) : Promise.resolve(null)),
    [selectedId]
  );

  const items = lone.data?.items ?? [];
  const riskCounts = useMemo(() => getRiskCounts(items), [items]);
  const signalCounts = useMemo(() => getSignalCounts(items), [items]);

  const flaggedCount = items.filter(
    (item) => item.status === 'flagged' || item.status === 'confirmed'
  ).length;

  const refreshAll = () => {
    points.reload();
    lone.reload();
    if (selectedId) detail.reload();
  };

  return (
    <main className="lone-page">
      <header className="lone-page-heading">
        <div>
          <h1>Lone threats</h1>
          <p>Identify and investigate isolated suspicious beneficiaries.</p>
        </div>

        <div className="lone-page-search">
          <RecordSearch
            onSelect={(recordId) => {
              setSelectedId(recordId);
              setActiveTab('details');
            }}
        />
        </div>
      </header>

      <ErrorBox
        error={points.error || lone.error}
        onRetry={refreshAll}
      />

      <section className="lone-summary-grid">
        <div className="lone-stat-card stat-red">
          <span className="lone-stat-icon">!</span>
          <div>
            <strong>{flaggedCount}</strong>
            <span>Flagged / confirmed</span>
            <small>Loaded results</small>
          </div>
        </div>

        <div className="lone-stat-card stat-orange">
          <span className="lone-stat-icon">▲</span>
          <div>
            <strong>{riskCounts.high}</strong>
            <span>High risk</span>
            <small>Loaded results</small>
          </div>
        </div>

        <div className="lone-stat-card stat-blue">
          <span className="lone-stat-icon">●</span>
          <div>
            <strong>{points.data?.points?.length ?? '—'}</strong>
            <span>Points in map</span>
            <small>Current map view</small>
          </div>
        </div>
      </section>

      <section className="lone-top-grid">
        <div className="lone-map-panel">
          {points.loading ? (
            <Loading label="Loading behavioural risk map" />
          ) : points.data ? (
            <PointCloud
              data={points.data}
              selectedId={selectedId}
              onSelect={(recordId) => {
                setSelectedId(recordId);
                if (recordId) setActiveTab('details');
              }}
          />
          ) : (
            <p className="lone-empty">No map data is available.</p>
          )}
        </div>

        <div className="lone-insights-column">
          <RiskDistribution counts={riskCounts} />
          <SignalSummary counts={signalCounts} />
        </div>
      </section>

      <section className="lone-bottom-section">
        <div className="lone-section-heading">
          <h2>Investigation workspace</h2>
          <p>Choose a panel below. Only one panel opens at a time.</p>
        </div>

        <div className="lone-tabs-grid">
          <ExpandableTab
            id="risk"
            activeTab={activeTab}
            onToggle={setActiveTab}
            icon="◔"
            title="Risk distribution"
          >
            <RiskDistribution counts={riskCounts} />
          </ExpandableTab>

          <ExpandableTab
            id="signals"
            activeTab={activeTab}
            onToggle={setActiveTab}
            icon="▥"
            title="Anomaly signals"
          >
            <SignalSummary counts={signalCounts} />
          </ExpandableTab>

          <ExpandableTab
            id="records"
            activeTab={activeTab}
            onToggle={setActiveTab}
            icon="▤"
            title="Beneficiary records"
          >
            {lone.loading ? (
              <Loading label="Loading beneficiary records" />
            ) : lone.data ? (
              <LoneList
                data={lone.data}
                signal={signal}
                onSignalChange={setSignal}
                level={level}
                onLevelChange={setLevel}
                onSelect={(recordId) => {
                  setSelectedId(recordId);
                  setActiveTab('details');
                }}
                onChanged={refreshAll}
              />
            ) : (
              <p className="lone-empty">No beneficiary records are available.</p>
            )}
          </ExpandableTab>

          <ExpandableTab
            id="details"
            activeTab={activeTab}
            onToggle={setActiveTab}
            icon="▣"
            title="Selected beneficiary details"
          >
            {selectedId ? (
              <LoneDetailPanel
                record={detail.data}
                loading={detail.loading}
                error={detail.error}
                onBack={() => {
                  setSelectedId(null);
                  setActiveTab('records');
                }}
                onChanged={refreshAll}
              />
            ) : (
              <p className="lone-empty">
                Select a point on the map or a record in the table to view its details.
              </p>
            )}
          </ExpandableTab>
        </div>
      </section>
    </main>
  );
}
