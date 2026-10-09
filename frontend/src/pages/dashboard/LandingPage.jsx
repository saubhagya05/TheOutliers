// Step 1 of the flow: title + a small dataset section (use ours or upload). Then /analyse.
import { useNavigate } from 'react-router-dom';
import { DatasetPicker } from '../../components/DatasetGate.jsx';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
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

        <DatasetPicker onChosen={() => navigate('/analyse')} />

        <footer className="landing-footer">
          <span>IDENTIFY PATTERNS. DETECT FRAUD.</span>
          <span className="landing-version">THREAT DETECTION WORKSPACE</span>
        </footer>
      </div>
    </main>
  );
}
