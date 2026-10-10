// OWNER: Lone. Same visual language as the Ring page's ConstellationGraph.
// Each lone-ghost signal is a hub (like a ring); flagged records are nodes in their top signal's colour,
// linked to every signal they trigger. Normal records are faint background stars.
// Props: items (lone list items), stars (normal points), selectedSignal, selectedRecordId,
//        onSelectSignal(id | null), onSelectRecord(id | null)
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Empty } from '../../../components/States.jsx';
import { LONE_SIGNALS, SIGNAL_BY_ID, signalsOf, topSignalOf } from '../signals.js';
import '../../rings/rings.css';

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
const hubId = (signal) => `SIG:${signal}`;

export default function LoneConstellation({ items, stars, selectedSignal, selectedRecordId, onSelectSignal, onSelectRecord }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 640 });

  const anim = useRef({ focus: 0 });
  const target = useRef({});
  const selectedSignals = useMemo(() => {
    const rec = selectedRecordId && items.find((i) => i.recordId === selectedRecordId);
    return rec ? signalsOf(rec) : [];
  }, [items, selectedRecordId]);
  target.current = { signal: selectedSignal, record: selectedRecordId, recordSignals: selectedSignals };

  const palette = useMemo(() => ({
    muted: parseColor(cssVar('--muted') || '#8a8a8a'),
    faint: parseColor(cssVar('--faint') || '#3a3a3a'),
    text: parseColor(cssVar('--text') || '#f5f5f5'),
    teal: parseColor(cssVar('--node-teal') || '#1fb6c1'),
    red: parseColor(cssVar('--red') || '#ff2d2d'),
  }), []);
  const colorOf = (signal) => (SIGNAL_BY_ID[signal] ? parseColor(SIGNAL_BY_ID[signal].color) : palette.muted);

  const positions = useRef(new Map());
  const graphData = useMemo(() => {
    const keep = (n) => {
      const p = positions.current.get(n.id);
      return p ? { ...n, x: p.x, y: p.y } : n;
    };
    const nodes = LONE_SIGNALS.map((s) => keep({ id: hubId(s.id), kind: 'hub', signal: s.id, label: s.label }));
    const links = [];
    for (const it of items) {
      const sigs = signalsOf(it);
      nodes.push(keep({ id: it.recordId, kind: 'ghost', signal: topSignalOf(it), signals: sigs, label: it.fields.name,
        riskScore: it.riskScore, status: it.status }));
      for (const s of sigs) links.push({ source: it.recordId, target: hubId(s), signal: s });
    }
    for (const s of stars) nodes.push(keep({ id: s.recordId, kind: 'star', label: s.recordId, riskScore: s.riskScore }));
    return { nodes, links };
  }, [items, stars]);
  useEffect(() => () => {
    for (const n of graphData.nodes) if (n.x !== undefined) positions.current.set(n.id, { x: n.x, y: n.y });
  }, [graphData]);

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Signal hubs sit on a ring; each ghost is pulled toward its top signal, stars drift around the centre.
  useLayoutEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const anchor = new Map(LONE_SIGNALS.map((s, i) => {
      const ang = (i / LONE_SIGNALS.length) * 2 * Math.PI - Math.PI / 2;
      return [s.id, { x: Math.cos(ang) * 260, y: Math.sin(ang) * 260 }];
    }));
    for (const n of graphData.nodes) {
      if (n.kind === 'hub') {
        const a = anchor.get(n.signal);
        n.fx = a.x;
        n.fy = a.y;
      }
    }
    fg.d3Force('charge').strength((n) => (n.kind === 'star' ? -1 : -18));
    fg.d3Force('center', null);
    fg.d3Force('link').strength(0.02);
    fg.d3Force('anchor', (alpha) => {
      for (const n of graphData.nodes) {
        if (n.kind === 'hub') continue;
        const t = n.kind === 'ghost' ? anchor.get(n.signal) : null;
        const k = (t ? 0.2 : 0.02) * alpha;
        const tx = t ? t.x * 0.78 : 0;
        const ty = t ? t.y * 0.78 : 0;
        n.vx = (n.vx || 0) + (tx - (n.x || 0)) * k;
        n.vy = (n.vy || 0) + (ty - (n.y || 0)) * k;
      }
    });
    fg.d3ReheatSimulation();
  }, [graphData]);

  const inFocus = (n) => {
    const t = target.current;
    if (t.record) return n.id === t.record || (n.kind === 'hub' && t.recordSignals.includes(n.signal));
    if (t.signal) return (n.kind === 'hub' && n.signal === t.signal) || (n.kind === 'ghost' && n.signals.includes(t.signal));
    return false;
  };
  const focusActive = () => !!(target.current.record || target.current.signal);

  const fit = (ms) => {
    const fg = fgRef.current;
    if (!fg) return;
    if (focusActive()) fg.zoomToFit(ms, 60, inFocus);
    else fg.zoomToFit(ms, 18, (n) => n.kind !== 'star');
  };
  useEffect(() => { fit(800); }, [selectedSignal, selectedRecordId, graphData, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const ease = () => {
    anim.current.focus += ((focusActive() ? 1 : 0) - anim.current.focus) * 0.12;
  };

  const drawNode = (node, ctx, scale) => {
    const { focus } = anim.current;
    const sel = inFocus(node);
    const hub = node.kind === 'hub';
    const star = node.kind === 'star';
    const deflagged = node.status === 'deflagged';

    // Focused cluster: detailed view like a selected ring. Records = teal ringed circles, signals = red triangles.
    if (sel) {
      const px = 1 / scale;
      const col = hub ? palette.red : palette.teal;
      const picked = node.id === target.current.record;
      ctx.save();
      if (!deflagged) { ctx.shadowColor = rgba(col, 1); ctx.shadowBlur = 14; }
      if (hub) {
        const r = 15 * px;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y - r);
        ctx.lineTo(node.x + r * 0.95, node.y + r * 0.7);
        ctx.lineTo(node.x - r * 0.95, node.y + r * 0.7);
        ctx.closePath();
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
        ctx.font = `${11 * px}px sans-serif`;
        ctx.fillStyle = rgba(palette.text, 0.9);
        ctx.fillText(node.label, node.x, node.y + r * 1.6);
      } else {
        const r = (picked ? 8 : 6) * px;
        ctx.strokeStyle = rgba(deflagged ? palette.muted : picked ? palette.text : col, 1);
        ctx.lineWidth = (picked ? 2.4 : 1.8) * px;
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

    const base = star ? 0.4 : 1;
    const alpha = base * (1 - focus * (1 - DIM_ALPHA / base));
    const col = star ? palette.muted : colorOf(node.signal);
    const r = hub ? 7 : star ? 1.1 : 2.4 + (node.riskScore || 0) / 60;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (!star && !deflagged) { ctx.shadowColor = rgba(col, 1); ctx.shadowBlur = hub ? 14 : 8; }
    ctx.beginPath();
    if (hub) ctx.rect(node.x - r, node.y - r, r * 2, r * 2);
    else ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    if (deflagged) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(palette.muted, 1);
      ctx.lineWidth = 1 / scale + 0.4;
      ctx.stroke();
    } else {
      ctx.fillStyle = rgba(col, 1);
      ctx.fill();
      if (hub) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = rgba(palette.text, 0.9);
        ctx.lineWidth = 0.8 / scale + 0.3;
        ctx.stroke();
        ctx.fillStyle = rgba(palette.text, 0.85);
        ctx.font = `${Math.max(3, 11 / scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + r + 12 / scale);
      }
    }
    ctx.restore();
  };

  const pointerArea = (node, color, ctx, scale = 1) => {
    const r = node.kind === 'star' ? 2 : node.kind === 'hub' ? Math.max(9, 14 / scale) : Math.min(9, 12 / scale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  const linkSelected = (l) => {
    const t = target.current;
    const src = typeof l.source === 'object' ? l.source.id : l.source;
    if (t.record) return src === t.record;
    if (t.signal) return l.signal === t.signal;
    return false;
  };
  const linkColor = (l) => {
    if (linkSelected(l)) return rgba(palette.muted, 0.96);
    const { focus } = anim.current;
    const dim = focusActive() ? DIM_ALPHA * 0.5 : 1;
    return rgba(colorOf(l.signal), 0.35 * (1 - focus + focus * dim));
  };
  const linkWidth = (l) => {
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    return linkSelected(l) ? 2.2 / zoom : 0.5;
  };

  const tooltip = (n) => {
    const sub = n.kind === 'hub' ? `signal · ${esc(SIGNAL_BY_ID[n.signal].hint)}`
      : n.kind === 'ghost' ? `${esc(n.id)} · risk ${esc(n.riskScore)} · ${esc(n.status)}` : `${esc(n.id)} · not flagged`;
    return `<div style="background:#0F0F11;border:1px solid ${rgba(palette.faint, 1)};padding:6px 10px;border-radius:6px;font-size:12px">
      <div style="color:#fff">${esc(n.label)}</div><div style="color:${rgba(palette.muted, 1)}">${sub}</div></div>`;
  };

  if (!items.length) return <Empty label="No lone ghosts to draw" />;

  const hint = selectedRecordId ? `${selectedRecordId} · click empty space to reset`
    : selectedSignal ? `${SIGNAL_BY_ID[selectedSignal].label} · click empty space to reset` : 'Click a signal or a record to inspect it';

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: 'calc(100vh - 180px)', minHeight: 600 }}>
      <ForceGraph2D
        ref={fgRef}
        width={size.w}
        height={size.h}
        graphData={graphData}
        backgroundColor="#0F0F11"
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
        onEngineStop={() => fit(500)}
        onNodeClick={(n) => {
          if (n.kind === 'hub') { onSelectRecord(null); onSelectSignal(n.signal); }
          else if (n.kind === 'ghost') onSelectRecord(n.id);
        }}
        onBackgroundClick={() => { onSelectRecord(null); onSelectSignal(null); }}
      />
      <div className="graph-hint">{hint}</div>
    </div>
  );
}
