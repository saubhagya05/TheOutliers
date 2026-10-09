import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="landing-page">
      <div className="landing-content">
        <section className="landing-hero">
          <span className="landing-eyebrow">
            WELFARE FRAUD DETECTION
          </span>

<h1>
  Find the <span>FRAUD</span> others <span>MISS.</span>
</h1>


          <p>
            Uncover hidden fraud networks. Detect suspicious beneficiaries.
            Look beyond ordinary identity checks.
          </p>
        </section>

        <section className="landing-threats">
          <article className="landing-threat-card landing-ring">
            <div className="threat-visual-icon network-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="9" r="4" />
                <circle cx="11" cy="34" r="4" />
                <circle cx="37" cy="34" r="4" />
                <path d="M24 13V22M11 30V25H37V30M24 22L11 30M24 22L37 30" />
              </svg>
            </div>

            <span className="threat-index">01 / NETWORK ANALYSIS</span>
            <h2>Ring Ghosts</h2>

            <p>
              Uncover suspicious beneficiary networks and coordinated
              fraud patterns across shared accounts and money flows.
            </p>

            <button
              className="analyze-button"
              onClick={() => navigate('/rings')}
            >
              Analyze Ring Threats <span aria-hidden="true">↗</span>
            </button>
          </article>

          <article className="landing-threat-card landing-lone">
            <div className="threat-visual-icon scan-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" fill="none">
                <path d="M17 7H12Q7 7 7 12V17M31 7H36Q41 7 41 12V17M7 31V36Q7 41 12 41H17M41 31V36Q41 41 36 41H31" />
                <circle cx="24" cy="21" r="7" />
                <path d="M29 26L35 32" />
              </svg>
            </div>

            <span className="threat-index">02 / INDIVIDUAL ANALYSIS</span>
            <h2>Lone Ghosts</h2>

            <p>
              Identify suspicious individual beneficiaries through
              identity checks and behavioural analysis.
            </p>

            <button
              className="analyze-button"
              onClick={() => navigate('/lone')}
            >
              Analyze Lone Threats <span aria-hidden="true">↗</span>
            </button>
          </article>
        </section>


        <footer className="landing-footer">
          <span>IDENTIFY PATTERNS. DETECT FRAUD.</span>
          <span className="landing-version">THREAT DETECTION WORKSPACE</span>
        </footer>
      </div>
    </main>
  );
}
