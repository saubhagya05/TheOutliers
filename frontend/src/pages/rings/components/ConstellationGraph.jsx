// OWNER: Ring. Props:
//   data = GET /api/rings/graph response { nodes, edges, rings }
//   selectedRingId, onSelectRing(ringId | null), baselineView (bool)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Empty } from '../../../components/States.jsx';
import '../rings.css';

const HUBS = new Set(['account', 'upi', 'biometric', 'ip', 'phone', 'email', 'address', 'agent', 'device']);
const DIM_ALPHA = 0.08;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function parseColor(c) {
  const h = c.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function ConstellationGraph({ data, selectedRingId, onSelectRing, baselineView }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 640 });

  // Animated blend values, eased every frame (onRenderFramePre).
  const anim = useRef({ focus: 0, grey: 0 });
  const target = useRef({ selected: null, grey: 0 });
  target.current = { selected: selectedRingId, grey: baselineView ? 1 : 0 };

  const palette = useMemo(
    () => ({
      muted: parseColor(cssVar('--muted') || '#8a8a8a'),
      faint: parseColor(cssVar('--faint') || '#3a3a3a'),
      text: parseColor(cssVar('--text') || '#f5f5f5'),
      teal: parseColor(cssVar('--node-teal') || '#1fb6c1'),
      red: parseColor(cssVar('--red') || '#ff2d2d'),
    }),
    [],
  );

  const colorOf = useMemo(() => {
    const m = new Map(data.rings.map((r) => [r.ringId, parseColor(r.color)]));
    return (ringId) => m.get(ringId) || palette.muted;
  }, [data.rings, palette]);

  // Keep node positions across refreshes so a deflag does not reshuffle the whole sky.
  const positions = useRef(new Map());
  const graphData = useMemo(() => {
    const nodes = data.nodes.map((n) => {
      const p = positions.current.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : { ...n };
    });
    const links = data.edges.map((e) => ({ ...e }));
    return { nodes, links };
  }, [data]);
  useEffect(() => () => {
    for (const n of graphData.nodes) if (n.x !== undefined) positions.current.set(n.id, { x: n.x, y: n.y });
  }, [graphData]);

  // Track container size.
  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Each ring is pulled toward its own anchor on a spiral, so constellations separate instead of piling up.
  // Background stars barely repel and drift loosely around the centre.
  useLayoutEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const ids = data.rings.map((r) => r.ringId);
    const anchor = new Map(ids.map((id, i) => {
      const ang = i * 2.399963; // golden angle
      const rad = 90 * Math.sqrt(i + 0.6) * 1.9;
      return [id, { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad }];
    }));
    fg.d3Force('charge').strength((n) => (n.ringId ? -30 : -1));
    fg.d3Force('center', null);
    fg.d3Force('anchor', (alpha) => {
      for (const n of graphData.nodes) {
        const t = anchor.get(n.ringId);
        const k = (t ? 0.25 : 0.02) * alpha;
        n.vx = (n.vx || 0) + ((t ? t.x : 0) - (n.x || 0)) * k;
        n.vy = (n.vy || 0) + ((t ? t.y : 0) - (n.y || 0)) * k;
      }
    });
    fg.d3ReheatSimulation();
  }, [graphData, data.rings]);

  // Zoom to the selected ring (or back out when cleared).
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (selectedRingId) fg.zoomToFit(800, 70, (n) => n.ringId === selectedRingId);
    else fg.zoomToFit(700, 18, (n) => !!n.ringId);
  }, [selectedRingId, graphData, size]);

  const ease = () => {
    const a = anim.current;
    const t = target.current;
    a.focus += ((t.selected ? 1 : 0) - a.focus) * 0.12;
    a.grey += (t.grey - a.grey) * 0.1;
  };

  const drawNode = (node, ctx, scale) => {
    const { focus, grey } = anim.current;
    const sel = target.current.selected;
    const inRing = !!node.ringId;
    const isSel = inRing && node.ringId === sel;
    const hub = HUBS.has(node.type);

    // Alpha: background stars are faint; when a ring is selected, everything else dims toward DIM_ALPHA.
    const base = inRing ? 1 : 0.75;
    const alpha = isSel ? 1 : base * (1 - focus * (1 - DIM_ALPHA / base));

    // Selected ring: detailed network view. Beneficiaries = teal ringed circles, shared hubs = red warning
    // triangles. Sizes are in screen pixels (1/scale) so they stay readable at any zoom.
    if (isSel) {
      const px = 1 / scale;
      const deflagged = node.status === 'deflagged';
      const col = mix(hub ? palette.red : palette.teal, palette.muted, grey);
      ctx.save();
      if (!deflagged) {
        ctx.shadowColor = rgba(col, 1);
        ctx.shadowBlur = 14;
      }
      if (hub) {
        const r = 13 * px;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - r);
        ctx.lineTo(node.x + r * 0.95, node.y + r * 0.7);
        ctx.lineTo(node.x - r * 0.95, node.y + r * 0.7);
        ctx.closePath();
        if (deflagged) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = rgba(palette.muted, 1);
          ctx.lineWidth = 1.5 * px;
          ctx.stroke();
        } else {
          ctx.fillStyle = rgba(mix(col, [0, 0, 0], 0.35), 1);
          ctx.fill();
          ctx.strokeStyle = rgba(col, 1);
          ctx.lineWidth = 2 * px;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgba(palette.text, 1);
          ctx.font = `bold ${r * 1.1}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('!', node.x, node.y + r * 0.2);
        }
      } else {
        const r = 6 * px;
        ctx.strokeStyle = rgba(deflagged ? palette.muted : col, 1);
        ctx.lineWidth = 1.8 * px;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3 * px, 0, 2 * Math.PI);
        ctx.stroke();
        if (!deflagged) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = rgba(col, 1);
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    let col = inRing ? colorOf(node.ringId) : palette.muted;
    if (inRing) col = mix(col, palette.muted, grey);

    // Never smaller than a few screen pixels, so nodes stay visible when the whole sky is in view.
    const px = 1 / scale;
    const r = inRing ? Math.max(hub ? 5 : 3.2, (hub ? 5.5 : 4) * px) : Math.max(1.1, 2 * px);
    const deflagged = node.status === 'deflagged';

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (inRing && !deflagged) {
      ctx.shadowColor = rgba(col, 1);
      ctx.shadowBlur = (isSel ? 18 : 8) * (1 - grey * 0.8);
    }
    ctx.beginPath();
    if (hub) ctx.rect(node.x - r, node.y - r, r * 2, r * 2);
    else ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);

    if (deflagged) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(palette.muted, 1);
      ctx.lineWidth = 1 / scale + 0.4;
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(inRing ? col : palette.muted, 1);
      ctx.fill();
      if (hub) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(palette.text, 0.9);
        ctx.lineWidth = 0.8 / scale + 0.3;
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const pointerArea = (node, color, ctx, scale = 1) => {
    const r = node.ringId ? Math.min(9, 12 / scale) : 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  const linkColor = (l) => {
    const src = typeof l.source === 'object' ? l.source : null;
    const ringId = src && src.ringId;
    if (!ringId) return rgba(palette.faint, 0.35);
    const { focus, grey } = anim.current;
    const sel = target.current.selected;
    if (sel === ringId) return rgba(palette.muted, 0.96);
    const dim = sel ? DIM_ALPHA * 0.5 : 1;
    const a = 0.41 * (1 - focus + focus * dim);
    return rgba(mix(colorOf(ringId), palette.muted, grey), a);
  };

  const linkWidth = (l) => {
    const src = typeof l.source === 'object' ? l.source : null;
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    return src && src.ringId && src.ringId === target.current.selected ? 2.4 / zoom : 0.6;
  };

  const tooltip = (n) =>
    `<div style="background:#000;border:1px solid ${rgba(palette.faint, 1)};padding:6px 10px;border-radius:6px;font-size:12px">
      <div style="color:#fff">${esc(n.label)}</div>
      <div style="color:${rgba(palette.muted, 1)}">${esc(n.type)}${n.ringId ? ` · ${esc(n.ringId)}` : ''} · risk ${esc(n.riskScore)}</div>
    </div>`;

  if (!data.nodes.length) return <Empty label="No rings to draw" />;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: 'calc(100vh - 180px)', minHeight: 600 }}>
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#000"
        nodeRelSize={4}
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={pointerArea}
        nodeLabel={tooltip}
        linkColor={linkColor}
        linkWidth={linkWidth}
        autoPauseRedraw={false}
        onRenderFramePre={ease}
        warmupTicks={160}
        cooldownTicks={60}
        cooldownTime={4000}
        d3VelocityDecay={0.3}
        onEngineStop={() => {
          const fg = fgRef.current;
          const sel = target.current.selected;
          if (fg) fg.zoomToFit(500, sel ? 70 : 18, (n) => (sel ? n.ringId === sel : !!n.ringId));
        }}
        onNodeClick={(n) => onSelectRing(n.ringId || null)}
        onBackgroundClick={() => onSelectRing(null)}
      />
      <div className="graph-hint">{selectedRingId ? `${selectedRingId} · click empty space to reset` : 'Click a constellation to inspect a ring'}</div>
    </div>
  );
}
