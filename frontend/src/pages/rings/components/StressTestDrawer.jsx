// OWNER: Ring. STAR FEATURE. Props: onClose().
// GET /api/stress-test/scenarios, then POST /api/stress-test { scenario }.
import { useState } from 'react';
import { getStressScenarios, runStressTest } from '../../../api/client.js';
import { useApi } from '../../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../../components/States.jsx';
import '../rings.css';

function Big({ label, value, red, sub }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="mono" style={{ fontSize: 40, lineHeight: 1, color: red ? 'var(--red)' : 'var(--text)' }}>{value}</div>
      <div className="section-label" style={{ marginTop: 6 }}>{label}</div>
      {sub && <div className="mono muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

const pct = (v) => `${Math.round(v * 100)}%`;

export default function StressTestDrawer({ onClose }) {
  const scenarios = useApi(() => getStressScenarios(), []);
  const [result, setResult] = useState(null);
  const [active, setActive] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const run = (id) => {
    setActive(id);
    setRunning(true);
    setError(null);
    runStressTest(id).then(setResult).catch(setError).finally(() => setRunning(false));
  };

  return (
    <div className="drawer" style={{ zIndex: 40 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>What if fraudsters adapt?</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <p className="muted">Remove a signal the way a smart ring would, and see how many rings we still catch.</p>
      <ErrorBox error={scenarios.error || error} />
      {scenarios.loading && !scenarios.data && <Loading label="Loading scenarios" />}
      <div style={{ display: 'grid', gap: 8, margin: '16px 0' }}>
        {scenarios.data && scenarios.data.scenarios.map((s) => (
          <button key={s.id} className={`btn ${active === s.id ? 'btn-active' : ''}`} disabled={running} onClick={() => run(s.id)} title={s.description} style={{ textAlign: 'left' }}>
            {s.label}
          </button>
        ))}
      </div>

      {running && <Loading label="Re-running detection" />}

      {result && !running && (
        <div style={{ display: 'grid', gap: 22 }}>
          <div className="row" style={{ justifyContent: 'space-around', flexWrap: 'nowrap' }}>
            <Big label="Before" value={result.before.ringsDetected} sub={`recall ${pct(result.before.recall)}`} />
            <span className="muted" style={{ fontSize: 24 }}>→</span>
            <Big label="Adapted" value={result.adapted.ringsDetected} red sub={`recall ${pct(result.adapted.recall)}`} />
            <span className="muted" style={{ fontSize: 24 }}>→</span>
            <Big label="Recovered" value={result.recovered.ringsDetected} sub={`recall ${pct(result.recovered.recall)}`} />
          </div>
          <p>{result.takeaway}</p>
          <div className="muted" style={{ fontSize: 12 }}>
            Lost: {result.adapted.lostSignals.join(', ') || 'none'}. Recovered with: {result.recovered.signalsUsed.join(', ') || 'none'}.
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 8 }}>Risk score per ring</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {result.rings.map((r) => (
                <div key={r.ringId} style={{ display: 'grid', gap: 3 }}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12 }}>
                    <span className="mono">{r.ringId}</span>
                    <span className="mono muted">{r.before} → {r.adapted} → {r.recovered}</span>
                  </div>
                  <div className="bar-track"><div className="bar-fill neutral" style={{ width: `${r.before}%` }} /></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${r.adapted}%`, opacity: 0.55 }} /></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${r.recovered}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>Bars: before (grey), adapted (dim red), recovered (red).</div>
          </div>
        </div>
      )}
    </div>
  );
}
