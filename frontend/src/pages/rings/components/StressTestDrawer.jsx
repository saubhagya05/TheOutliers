// OWNER: Ring. STAR FEATURE: build last. Props: onClose().
// GET /api/stress-test/scenarios, then POST /api/stress-test { scenario }.
import { useState } from 'react';
import { getStressScenarios, runStressTest } from '../../../api/client.js';
import { useApi } from '../../../hooks/useApi.js';
import { ErrorBox, Todo } from '../../../components/States.jsx';

export default function StressTestDrawer({ onClose }) {
  const scenarios = useApi(() => getStressScenarios(), []);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = (id) => runStressTest(id).then(setResult).catch(setError);

  return (
    <div className="panel" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(480px, 100vw)', borderRadius: 0, zIndex: 40, overflow: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>What if fraudsters adapt?</h2>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
      <ErrorBox error={scenarios.error || error} />
      <div style={{ display: 'grid', gap: 8, margin: '16px 0' }}>
        {scenarios.data && scenarios.data.scenarios.map((s) => (
          <button key={s.id} className="btn" onClick={() => run(s.id)} title={s.description}>{s.label}</button>
        ))}
      </div>
      {result && (
        <Todo name="StressTest result">
          {`before ${result.before.ringsDetected} -> adapted ${result.adapted.ringsDetected} -> recovered ${result.recovered.ringsDetected}
${result.takeaway}
Render: 3 big numbers with arrows, then per-ring bars (before / adapted / recovered). Demo: All of the above.`}
        </Todo>
      )}
    </div>
  );
}
