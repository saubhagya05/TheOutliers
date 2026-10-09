// OWNER: Dashboard. Spec: docs/TASKS.md "Person A".
// Big heading, ring vs lone explanation, stat strip, baseline comparison, two big buttons.
import { useNavigate, Link } from 'react-router-dom';
import { getOverview, getBaseline } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox } from '../../components/States.jsx';
import StatStrip from './components/StatStrip.jsx';
import ThreatCards from './components/ThreatCards.jsx';
import BaselineStrip from './components/BaselineStrip.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const overview = useApi(() => getOverview(), []);
  const baseline = useApi(() => getBaseline(), []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 32, paddingTop: 32 }}>
      <section>
        {/* TODO(dashboard): final headline + subline copy, big type, subtle red accent */}
        <h1 style={{ fontSize: 48 }}>Find the people quietly collecting welfare money.</h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 720 }}>
          Identity checks tell you each beneficiary is real. We find the rings and lone ghosts that siphon scheme funds.
        </p>
      </section>

      <ThreatCards />

      <ErrorBox error={overview.error} onRetry={overview.reload} />
      {overview.data && <StatStrip overview={overview.data} />}

      <ErrorBox error={baseline.error} onRetry={baseline.reload} />
      {baseline.data && <BaselineStrip baseline={baseline.data} />}

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <button className="btn btn-primary" style={{ padding: 24, fontSize: 18 }} onClick={() => navigate('/rings')}>
          Check projected ring threats →
        </button>
        <button className="btn" style={{ padding: 24, fontSize: 18 }} onClick={() => navigate('/lone')}>
          Check lone threats →
        </button>
      </section>

      <Link to="/dataset" className="muted">How we built the dataset and benchmarked it →</Link>
    </div>
  );
}
