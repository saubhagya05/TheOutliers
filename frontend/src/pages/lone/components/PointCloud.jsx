// OWNER: Lone. Props: data = GET /api/lone/points response { points, axes }, selectedId, onSelect(recordId | null).
// Suggested: plain SVG or <canvas> (fastest, full control). recharts ScatterChart also works (installed).
import { Todo } from '../../../components/States.jsx';

export default function PointCloud({ data, selectedId, onSelect }) {
  const flagged = data.points.filter((p) => p.flagged);
  return (
    <div>
      <Todo name="PointCloud">
        {`${data.points.length} points, ${flagged.length} flagged. Selected: ${selectedId || 'none'}
x, y are 0-1 -> scale to the panel size.

Build:
- Black background. Normal points (flagged=false): tiny, faint grey.
- Flagged points: larger, red, soft glow; size by riskScore.
- status "deflagged": hollow grey ring. status "confirmed": solid red with white outline.
- Click a point -> onSelect(recordId). Click empty space -> onSelect(null).
- Selected point: brighten + pulse; dim all others.
- Hover tooltip: recordId, riskScore, topSignal.
- Optional legend: colour by topSignal instead of plain red.`}
      </Todo>
      <div className="row" style={{ marginTop: 12 }}>
        {flagged.slice(0, 8).map((p) => (
          <button key={p.recordId} className="btn" onClick={() => onSelect(p.recordId)}>{p.recordId}</button>
        ))}
      </div>
    </div>
  );
}
