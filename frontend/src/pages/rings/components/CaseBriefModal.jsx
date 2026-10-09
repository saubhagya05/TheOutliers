// OWNER: Ring. Props: ringId, onClose(). Calls POST /api/rings/:ringId/brief.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getRingBrief } from '../../../api/client.js';
import { useApi } from '../../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../../components/States.jsx';
import { formatDateTime } from '../../../components/format.js';
import '../rings.css';

export default function CaseBriefModal({ ringId, onClose }) {
  const brief = useApi(() => getRingBrief(ringId), [ringId]);
  const [copied, setCopied] = useState(false);
  const b = brief.data;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy the brief:', b.markdown);
    }
  };

  // Portal to <body> so printing can hide the app (#root) and print only the paper.
  return createPortal(
    <div className="brief-overlay" onClick={onClose}>
      <div className="brief-shell" onClick={(e) => e.stopPropagation()}>
        <div className="row brief-actions" style={{ justifyContent: 'flex-end' }}>
          {b && <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy markdown'}</button>}
          {b && <button className="btn btn-primary" onClick={() => window.print()}>Print</button>}
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="brief-scroll">
          {brief.loading && <div className="panel"><Loading label="Writing case brief" /></div>}
          {brief.error && <ErrorBox error={brief.error} onRetry={brief.reload} />}
          {b && (
            <article className="brief-paper">
              <h1>{b.title}</h1>
              <div className="brief-meta">Generated {formatDateTime(b.generatedAt)} · {b.generatedBy}</div>
              {b.sections.map((s) => (
                <section key={s.heading}>
                  <h2>{s.heading}</h2>
                  <p>{s.body}</p>
                </section>
              ))}
            </article>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
