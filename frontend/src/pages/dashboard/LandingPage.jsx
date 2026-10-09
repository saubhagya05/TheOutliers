// Step 1 of the flow: title + a small dataset section (use ours or upload). Then /analyse.
// Choosing a dataset starts the line-trace effect over the bottom half of this page right away; once the
// dataset is ready and the lines have arrived, the page scrolls down into the next step, then routes to /analyse.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatasetPicker } from '../../components/DatasetGate.jsx';
import TraceTransition from './TraceTransition.jsx';
import AnalysePage from './AnalysePage.jsx';

const SCROLL_MS = 800;

export default function LandingPage() {
  const navigate = useNavigate();
  const [tracing, setTracing] = useState(false);
  const [traced, setTraced] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [scrolling, setScrolling] = useState(false); // next page mounted below
  const [moved, setMoved] = useState(false); // stack slid up

  const reset = () => { setTracing(false); setTraced(false); setChosen(false); };

  useEffect(() => {
    if (!(traced && chosen) || scrolling) return undefined;
    setScrolling(true);
    return undefined;
  }, [traced, chosen, scrolling]);

  // Once the next page is mounted below, slide the stack up, then route there.
  useEffect(() => {
    if (!scrolling) return undefined;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMoved(true)));
    const done = setTimeout(() => navigate('/analyse'), SCROLL_MS + 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [scrolling, navigate]);

  return (
    <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          height: '200%',
          transform: moved ? 'translateY(-50%)' : 'translateY(0)',
          transition: `transform ${SCROLL_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
          willChange: 'transform',
        }}
      >
        <div style={{ height: '50%', position: 'relative' }}>
          <main className="landing-page">
            <div className="landing-content">
              <section className="landing-hero">
                <span className="landing-eyebrow">
                  WELFARE <span>FRAUD</span> DETECTION
                </span>
                <p>
                  Uncover hidden fraud networks. Detect suspicious beneficiaries.
                  Look beyond ordinary identity checks.
                </p>
              </section>

              <DatasetPicker onStart={() => setTracing(true)} onFail={reset} onChosen={() => setChosen(true)} />

              <footer className="landing-footer">
                <span>IDENTIFY PATTERNS. DETECT FRAUD.</span>
                <span className="landing-version">THREAT DETECTION WORKSPACE</span>
              </footer>
            </div>
          </main>
          {tracing && <TraceTransition onTraced={() => setTraced(true)} />}
        </div>
        <div style={{ height: '50%' }}>{scrolling && <AnalysePage />}</div>
      </div>
    </div>
  );
}
