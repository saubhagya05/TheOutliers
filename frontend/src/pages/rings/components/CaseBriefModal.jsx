// OWNER: Ring. Props: ringId, onClose(). Calls POST /api/rings/:ringId/brief.
import { getRingBrief } from '../../../api/client.js';
import { useApi } from '../../../hooks/useApi.js';
import { ErrorBox, Loading, Todo } from '../../../components/States.jsx';

export default function CaseBriefModal({ ringId, onClose }) {
  const brief = useApi(() => getRingBrief(ringId), [ringId]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ width: 'min(760px, 92vw)', maxHeight: '85vh', overflow: 'auto' }}>
        {brief.loading && <Loading label="Writing case brief" />}
        <ErrorBox error={brief.error} onRetry={brief.reload} />
        {brief.data && (
          <Todo name="CaseBriefModal">
            {`${brief.data.title}
Sections: ${brief.data.sections.map((s) => s.heading).join(', ')}
Render as a clean white "paper" document (print style), with Print and Copy-markdown buttons.
Use brief.data.sections; brief.data.markdown is for copy.`}
          </Todo>
        )}
        <button className="btn" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
