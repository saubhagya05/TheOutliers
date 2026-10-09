// OWNER: Ring. Props:
//   data = GET /api/rings/graph response { nodes, edges, rings }
//   selectedRingId, onSelectRing(ringId | null), baselineView (bool)
// Use react-force-graph-2d (already installed):  import ForceGraph2D from 'react-force-graph-2d';
//   graphData={{ nodes: data.nodes, links: data.edges }}   (it reads source/target from links)
import { Todo } from '../../../components/States.jsx';

export default function ConstellationGraph({ data, selectedRingId, onSelectRing, baselineView }) {
  const ringNodes = data.nodes.filter((n) => n.ringId).length;
  return (
    <div style={{ padding: 16 }}>
      <Todo name="ConstellationGraph">
        {`${data.nodes.length} nodes (${ringNodes} in rings, ${data.nodes.length - ringNodes} background), ${data.edges.length} edges, ${data.rings.length} rings
Selected ring: ${selectedRingId || 'none'} | baselineView: ${baselineView}

Build:
- Black canvas. Background nodes (ringId null) = tiny faint grey stars.
- Ring nodes coloured by data.rings[].color (map ringId -> color), soft glow.
- Hub nodes (type account/phone/agent/device/address) slightly bigger, different shape or ring outline.
- Edges thin, ring colour at low opacity.
- Click a node -> onSelectRing(node.ringId). Click empty space -> onSelectRing(null).
- When selectedRingId is set: that ring full brightness + zoomToFit on its nodes; everything else dimmed to ~10%.
- status "deflagged" nodes: hollow grey.
- baselineView = true: draw every ring node grey (what a unique-ID check sees), then animate back to colour when off.
- Hover tooltip: label, type, risk.`}
      </Todo>
      <div className="row" style={{ marginTop: 12 }}>
        {data.rings.map((r) => (
          <button key={r.ringId} className="btn" style={{ borderColor: r.color, color: r.color }} onClick={() => onSelectRing(r.ringId)}>
            {r.ringId}
          </button>
        ))}
      </div>
    </div>
  );
}
