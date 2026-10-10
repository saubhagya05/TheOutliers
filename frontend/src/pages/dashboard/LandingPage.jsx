// Step 1 of the flow: title + a small dataset section (use ours or upload). Then /analyse.
// One continuous transition: the moment a dataset is chosen, the trace lines start drawing AND the page starts
// sliding down to the next step, both over TRANSITION_MS. We route to /analyse once the slide has finished and the
// dataset is ready (an upload can take a few seconds longer; the next page waits, not clickable, until then).
// If the dataset fails, the page slides back so the error is visible.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatasetPicker } from '../../components/DatasetGate.jsx';
import TraceTransition, { traceMemory } from './TraceTransition.jsx';
import AnalysePage from './AnalysePage.jsx';

const TRANSITION_MS = 2200; // same as the trace lines (TraceTransition TRACE_MS)

export default function LandingPage() {
  const navigate = useNavigate();
  const [tracing, setTracing] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [mounted, setMounted] = useState(false); // next page mounted below
  const [moved, setMoved] = useState(false); // stack sliding / slid up
  const [slid, setSlid] = useState(false); // slide finished
  const [traceTop, setTraceTop] = useState(0); // where the lines start: just below the dataset section
  const stackRef = useRef(null);

  const start = () => {
    const stack = stackRef.current;
    const picker = stack && stack.querySelector('.picker');
    if (stack && picker) {
      const top = Math.round(picker.getBoundingClientRect().bottom - stack.getBoundingClientRect().top + 6);
      setTraceTop(top);
      traceMemory.offset = top - stack.clientHeight / 2; // canvas top relative to the next page
    }
    setTracing(true);
    setMounted(true);
  };

  const reset = () => {
    setMoved(false);
    setSlid(false);
    setChosen(false);
    setTimeout(() => { setTracing(false); setMounted(false); }, TRANSITION_MS);
  };

  // Start sliding as soon as the next page is mounted (a short delay so the browser animates from 0;
  // a timer, not requestAnimationFrame, so it also fires if the tab is in the background).
  useEffect(() => {
    if (!mounted) return undefined;
    const t = setTimeout(() => setMoved(true), 30);
    return () => clearTimeout(t);
  }, [mounted]);

  useEffect(() => {
    if (!moved) return undefined;
    const t = setTimeout(() => setSlid(true), TRANSITION_MS + 60);
    return () => clearTimeout(t);
  }, [moved]);

  useEffect(() => {
    if (slid && chosen) navigate('/analyse');
  }, [slid, chosen, navigate]);

  return (
    <div style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div
        ref={stackRef}
        style={{
          position: 'relative',
          height: '200%',
          transform: moved ? 'translateY(-50%)' : 'translateY(0)',
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`,
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

              <DatasetPicker onStart={start} onFail={reset} onChosen={() => setChosen(true)} />

              <footer className="landing-footer">
                <span>IDENTIFY PATTERNS. DETECT FRAUD.</span>
                <span className="landing-version">THREAT DETECTION WORKSPACE</span>
              </footer>
            </div>
          </main>
        </div>
        {/* Above the trace lines (z-index 1), so the lines pass behind the Ring / Lone cards.
            Not clickable until the dataset is ready. */}
        <div className="landing-next" style={{ height: '50%', position: 'relative', zIndex: 1, pointerEvents: chosen ? 'auto' : 'none' }}>
          {mounted && <AnalysePage withTrace={false} />}
          {slid && !chosen && <div className="landing-wait">Running detection on your data…</div>}
        </div>
        {/* Lines start below the dataset section and run on into the next page as it slides up. */}
        {tracing && <TraceTransition top={traceTop} onTraced={() => {}} />}
      </div>
    </div>
  );
}
