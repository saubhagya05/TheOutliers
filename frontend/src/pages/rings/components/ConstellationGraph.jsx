// OWNER: Ring. Props:
//   data = GET /api/rings/graph response { nodes, edges, rings }
//   selectedRingId, onSelectRing(ringId | null)
//
// Layout is deterministic (no physics), so rings read as structures instead of a tangle:
//   - each ring is a wheel: beneficiaries evenly around the rim, grouped by the shared item they use;
//   - shared items (account, phone, IP, email, UPI, biometric, address...) sit inside the wheel, at the
//     angle of the beneficiaries they connect, so a hub and its spokes read at a glance;
//   - rings are laid out on an even grid; unflagged background records are faint dots between them.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { Empty } from '../../../components/States.jsx';
import '../rings.css';

const isHub = (n) => n.type !== 'beneficiary';
const DIM_ALPHA = 0.08;
const VISIBLE_RINGS = 10; // overview shows this many rings (highest risk first); the rest appear when picked

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function parseColor(c) {
  const h = c.replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Stable pseudo-random 0-1 from a string (for scattering background dots).
function hash01(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

// Wheel layout for one ring, centred on (0, 0). Returns { pos: Map(id -> {x, y}), radius }.
function layoutRing(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id));
  const people = nodes.filter((n) => !isHub(n));
  const hubs = nodes.filter(isHub);

  const links = new Map(hubs.map((h) => [h.id, []]));
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    if (links.has(e.source) && !links.has(e.target)) links.get(e.source).push(e.target);
    else if (links.has(e.target) && !links.has(e.source)) links.get(e.target).push(e.source);
  }

  // Order the rim so people who share an item sit next to each other (biggest groups first).
  const order = [];
  const placed = new Set();
  const peopleIds = new Set(people.map((p) => p.id));
  [...hubs].sort((a, b) => links.get(b.id).length - links.get(a.id).length).forEach((h) => {
    for (const pid of links.get(h.id)) {
      if (peopleIds.has(pid) && !placed.has(pid)) { placed.add(pid); order.push(pid); }
    }
  });
  for (const p of people) if (!placed.has(p.id)) order.push(p.id);

  const n = Math.max(order.length, 1);
  const rim = 16 + 3.6 * Math.sqrt(n) + n * 0.55;
  const angle = new Map(order.map((id, i) => [id, (i / n) * 2 * Math.PI - Math.PI / 2]));
  const pos = new Map();
  for (const [id, a] of angle) pos.set(id, { x: Math.cos(a) * rim, y: Math.sin(a) * rim });

  // Hubs go inside, at the circular mean angle of the people they connect. Single-person items hug the rim;
  // neighbours at similar angles are staggered in depth so they do not overlap.
  const placedHubs = hubs.map((h) => {
    const as = links.get(h.id).map((pid) => angle.get(pid)).filter((a) => a !== undefined);
    if (!as.length) return { h, a: 0, deg: 0 };
    const sx = as.reduce((s, a) => s + Math.cos(a), 0);
    const sy = as.reduce((s, a) => s + Math.sin(a), 0);
    return { h, a: Math.atan2(sy, sx), deg: as.length, spread: Math.hypot(sx, sy) / as.length };
  }).sort((p, q) => p.a - q.a);
  // Items that touch people all around the wheel (a collector account, a shared agent) would pile up in the
  // middle at their mean angle. Spread those evenly on an inner ring instead; focused items keep their angle.
  const broad = placedHubs.filter((p) => p.deg > 1 && (p.spread ?? 0) < 0.5).sort((p, q) => q.deg - p.deg);
  const focused = placedHubs.filter((p) => !broad.includes(p));
  broad.forEach((p, i) => {
    if (broad.length === 1) { pos.set(p.h.id, { x: 0, y: 0 }); return; }
    const a = (i / broad.length) * 2 * Math.PI - Math.PI / 2;
    const r = (broad.length <= 4 ? 0.3 : i % 2 ? 0.48 : 0.2) * rim;
    pos.set(p.h.id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
  });
  let prevA = -Infinity;
  let flip = 0;
  for (const p of focused) {
    if (p.deg === 0) { pos.set(p.h.id, { x: 0, y: 0 }); continue; }
    flip = p.a - prevA < 0.55 ? flip + 1 : 0;
    prevA = p.a;
    let r = p.deg === 1 ? 0.78 : 0.45 + 0.2 * (p.spread ?? 0.5);
    r += (flip % 3) * 0.1;
    r = Math.min(r, 0.84);
    pos.set(p.h.id, { x: Math.cos(p.a) * rim * r, y: Math.sin(p.a) * rim * r });
  }

  // Overview: every node of the ring (beneficiaries and shared items) sits on one circle. Nodes keep the order of
  // their angle in the wheel, so people and the item they share stay close together; spacing is then even.
  const norm = (x) => (((x + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const items = [
    ...people.map((person) => ({ id: person.id, a: norm(angle.get(person.id)) })),
    ...placedHubs.map((p) => ({ id: p.h.id, a: p.deg ? norm(p.a) : 0 })),
  ].sort((p, q) => p.a - q.a || p.id.localeCompare(q.id));
  const ang = new Map(items.map((it, i) => [it.id, (i / items.length) * 2 * Math.PI - Math.PI / 2]));
  return { pos, ang, order, count: items.length, radius: rim };
}


const EDGE_LABELS = {
  sharedAccount: 'Shared account',
  sharedPhone: 'Shared phone',
  batchPhone: 'Batch phone numbers',
  sharedIp: 'Same IP',
  templatedEmail: 'Templated emails',
  sharedAddress: 'Shared address',
  sharedBiometric: 'Shared biometric',
  sharedUpi: 'Shared UPI',
  similarName: 'Look-alike names',
  transfer: 'Money transfer',
};

// Layered money-flow layout for rings with transfers, centred on (0, 0), left to right:
//   beneficiaries  ->  collector account  ->  agent accounts  (and back to members)
// Other shared items (phone batch, IP...) go in a row underneath. Returns null for rings without transfers.
function layoutFlow(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const transfers = edges.filter((e) => e.type === 'transfer' && byId.has(e.source) && byId.has(e.target));
  const isAccount = (id) => byId.get(id).type === 'account';
  const isPerson = (id) => !isHub(byId.get(id));
  const toCollector = new Map();
  for (const e of transfers) if (isPerson(e.source) && isAccount(e.target)) toCollector.set(e.target, (toCollector.get(e.target) || 0) + 1);
  const collectors = [...toCollector.keys()].sort((a, b) => toCollector.get(b) - toCollector.get(a));
  if (!collectors.length) return null;
  const agents = [...new Set(transfers.filter((e) => collectors.includes(e.source) && isAccount(e.target) && !collectors.includes(e.target)).map((e) => e.target))];
  const placed = new Set([...collectors, ...agents]);
  const others = nodes.filter((n) => isHub(n) && !placed.has(n.id));
  const people = nodes.filter((n) => !isHub(n)).sort((a, b) => a.id.localeCompare(b.id));

  const W = 230;
  const sp = 34;
  const H = Math.max((people.length - 1) * sp, 120);
  const pos = new Map();
  people.forEach((p, i) => pos.set(p.id, { x: -W, y: (i - (people.length - 1) / 2) * sp }));
  const spread = (list, x, gap) => list.forEach((id, i) => pos.set(id, { x, y: (i - (list.length - 1) / 2) * Math.min(gap, H / Math.max(list.length, 1)) }));
  spread(collectors, 0, 120);
  spread(agents, W, 110);
  others.forEach((n, i) => pos.set(n.id, { x: others.length === 1 ? 0 : -W + (i * 2 * W) / (others.length - 1), y: H / 2 + 80 }));

  const top = -H / 2 - 44;
  const cols = [
    { x: -W, y: top, label: 'Beneficiaries' },
    { x: 0, y: top, label: collectors.length > 1 ? 'Collector accounts' : 'Collector account' },
    ...(agents.length ? [{ x: W, y: top, label: 'Agent accounts, paying back to members' }] : []),
  ];
  return { pos, cols };
}

export default function ConstellationGraph({ data, selectedRingId, onSelectRing, baselineView }) {
  const wrapRef = useRef(null);
  const fgRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 640 });
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set());

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
  const edgeRgb = (type) => (type === 'transfer' ? palette.red : parseColor(cssVar(`--edge-${type}`) || '#8a8a8a'));

  // The legend filter belongs to one ring at a time.
  useEffect(() => setHiddenTypes(new Set()), [selectedRingId]);

  // Edge types present in the selected ring, for the legend.
  const legendTypes = useMemo(() => {
    if (!selectedRingId) return [];
    const ids = new Set(data.nodes.filter((n) => n.ringId === selectedRingId).map((n) => n.id));
    const counts = new Map();
    for (const e of data.edges) if (ids.has(e.source) && ids.has(e.target)) counts.set(e.type, (counts.get(e.type) || 0) + 1);
    return [...counts.entries()].sort((a, b) => (a[0] === 'transfer' ? -1 : b[0] === 'transfer' ? 1 : b[1] - a[1]));
  }, [data, selectedRingId]);

  const colorOf = useMemo(() => {
    const m = new Map(data.rings.map((r) => [r.ringId, parseColor(r.color)]));
    return (ringId) => m.get(ringId) || palette.muted;
  }, [data.rings, palette]);

  // Pin every node. Overview: the top rings are circles scattered at random (fixed seed) so that neighbours overlap,
  // like interlocking logo rings; every node of a ring sits on its circle. Selected ring: nodes glide to a detail
  // layout (wheel, or the layered money flow for rings with transfers).
  const built = useMemo(() => {
    const byRing = new Map();
    for (const n of data.nodes) if (n.ringId) byRing.set(n.ringId, [...(byRing.get(n.ringId) || []), n]);

    const rings = data.rings.filter((r) => byRing.has(r.ringId));
    const wheels = rings.map((r) => ({ id: r.ringId, ...layoutRing(byRing.get(r.ringId), data.edges) }));
    const wheelById = new Map(wheels.map((w) => [w.id, w]));
    const ringById = new Map(data.nodes.map((n) => [n.id, n.ringId]));

    // Which rings are drawn in the overview: the highest-risk ones.
    const visibleIds = new Set([...rings].sort((p, q) => q.riskScore - p.riskScore).slice(0, VISIBLE_RINGS).map((r) => r.ringId));
    const shown = wheels.filter((w) => visibleIds.has(w.id));
    for (const w of wheels) w.R = Math.max(46, 2.4 * w.count);

    // Rings that really share an item (same IP, same email template) are placed next to each other first.
    const bridges = new Map();
    for (const e of data.edges) {
      const ra = ringById.get(e.source);
      const rb = ringById.get(e.target);
      if (!ra || !rb || ra === rb || !visibleIds.has(ra) || !visibleIds.has(rb)) continue;
      bridges.set(ra, new Set([...(bridges.get(ra) || []), rb]));
      bridges.set(rb, new Set([...(bridges.get(rb) || []), ra]));
    }
    const order = [];
    const seen = new Set();
    for (const w of shown) {
      if (seen.has(w.id)) continue;
      const queue = [w.id];
      seen.add(w.id);
      while (queue.length) {
        const id = queue.shift();
        order.push(id);
        for (const nb of [...(bridges.get(id) || [])].sort()) if (!seen.has(nb)) { seen.add(nb); queue.push(nb); }
      }
    }

    // Random but repeatable placement: each ring lands overlapping an already placed ring (a linked one if it has
    // one), never nearly on top of another.
    const centre = new Map();
    order.forEach((id, i) => {
      const w = wheelById.get(id);
      if (i === 0) { centre.set(id, { x: 0, y: 0 }); return; }
      const placed = [...centre.keys()];
      const linked = placed.filter((q) => (bridges.get(id) || new Set()).has(q));
      let best = null;
      for (let k = 0; k < 80 && !best; k += 1) {
        const anchorId = (linked.length ? linked : placed)[Math.floor(hash01(id, 100 + k) * (linked.length ? linked : placed).length)];
        const an = wheelById.get(anchorId);
        const c0 = centre.get(anchorId);
        const dir = hash01(id, 200 + k) * 2 * Math.PI;
        const dist = (w.R + an.R) * (0.62 + 0.3 * hash01(id, 300 + k));
        const c = { x: c0.x + Math.cos(dir) * dist, y: c0.y + Math.sin(dir) * dist };
        const ok = placed.every((q) => Math.hypot(centre.get(q).x - c.x, centre.get(q).y - c.y) > 0.55 * (w.R + wheelById.get(q).R));
        if (ok) best = c;
      }
      if (!best) { const an = centre.get(placed[placed.length - 1]); best = { x: an.x + w.R * 1.4, y: an.y + (i % 2 ? w.R : -w.R) * 0.6 }; }
      centre.set(id, best);
    });
    const cs = [...centre.values()];
    const mid = { x: (Math.min(...cs.map((c) => c.x)) + Math.max(...cs.map((c) => c.x))) / 2, y: (Math.min(...cs.map((c) => c.y)) + Math.max(...cs.map((c) => c.y))) / 2 };

    const overview = new Map();
    const detail = new Map();
    const centres = [];
    const details = new Map();
    for (const w of wheels) {
      const shownHere = visibleIds.has(w.id);
      const c = shownHere ? centre.get(w.id) : mid; // rings not on show wait at the middle until picked
      if (shownHere) centres.push({ id: w.id, x: c.x, y: c.y, rim: w.R, r: w.R });
      for (const [nid, a] of w.ang) overview.set(nid, shownHere ? { x: c.x + Math.cos(a) * w.R, y: c.y + Math.sin(a) * w.R } : c);
      const flowLay = layoutFlow(byRing.get(w.id), data.edges);
      for (const [nid, p] of (flowLay ? flowLay.pos : w.pos)) detail.set(nid, { x: c.x + p.x, y: c.y + p.y });
      details.set(w.id, {
        nodes: [],
        isFlow: !!flowLay,
        cols: flowLay ? flowLay.cols.map((k) => ({ ...k, x: c.x + k.x, y: c.y + k.y })) : [],
        blend: 0,
      });
    }

    const span = Math.max(Math.max(...cs.map((c) => Math.abs(c.x - mid.x))), Math.max(...cs.map((c) => Math.abs(c.y - mid.y)))) + 120;
    const box = { x0: mid.x - span * 1.15, x1: mid.x + span * 1.15, y0: mid.y - span * 0.9, y1: mid.y + span * 0.9 };
    const nodes = data.nodes.map((n) => {
      let p = overview.get(n.id);
      if (!p) {
        // Background record: a faint dot somewhere in the sky.
        p = { x: box.x0 + hash01(n.id, 1) * (box.x1 - box.x0), y: box.y0 + hash01(n.id, 2) * (box.y1 - box.y0) };
      }
      const node = { ...n, x: p.x, y: p.y, fx: p.x, fy: p.y, wx: p.x, wy: p.y, shown: !n.ringId || visibleIds.has(n.ringId) };
      const d = detail.get(n.id);
      if (d && n.ringId) {
        node.lx = d.x;
        node.ly = d.y;
        details.get(n.ringId).nodes.push(node);
      }
      return node;
    });

    // Links inside a ring, plus the real links between rings (shared IP / email template), marked `cross`.
    const links = data.edges
      .filter((e) => ringById.get(e.source) && ringById.get(e.target))
      .map((e) => ({ ...e, cross: ringById.get(e.source) !== ringById.get(e.target) }));
    // Transfer links: thickness follows the rupee amount within the ring.
    for (const id of details.keys()) {
      const own = links.filter((l) => l.type === 'transfer' && ringById.get(l.source) === id);
      const maxAmt = Math.max(1, ...own.map((l) => l.amountInr || 0));
      for (const l of own) l.amtShare = (l.amountInr || 0) / maxAmt;
    }
    return { graph: { nodes, links }, flow: details, outlines: centres, visible: visibleIds };
  }, [data]);
  const graphData = built.graph;

  // Track container size: measure right away, then follow resizes.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s.w === Math.floor(r.width) && s.h === Math.floor(r.height) ? s : { w: Math.floor(r.width), h: Math.floor(r.height) }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Zoom to the selected ring (or back out to all rings when cleared).
  useEffect(() => {
    // Camera framing from the pinned coordinates: centre on the bounding box and zoom to fit it.
    const fit = () => {
      const fg = fgRef.current;
      if (!fg) return;
      const pad = selectedRingId ? (built.flow.get(selectedRingId)?.isFlow ? 100 : 70) : 18;
      const pts = graphData.nodes.filter((n) => (selectedRingId ? n.ringId === selectedRingId : !!n.ringId && n.shown));
      if (!pts.length) return;
      const flowRing = selectedRingId && built.flow.has(selectedRingId);
      const xs = pts.map((n) => (flowRing && n.lx !== undefined ? n.lx : n.wx));
      const ys = pts.map((n) => (flowRing && n.ly !== undefined ? n.ly : n.wy));
      const bw = Math.max(Math.max(...xs) - Math.min(...xs), 1);
      const bh = Math.max(Math.max(...ys) - Math.min(...ys), 1);
      const k = Math.min((size.w - pad * 2) / bw, (size.h - pad * 2) / bh);
      const ms = selectedRingId ? 800 : 700;
      fg.centerAt((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, ms);
      fg.zoom(Math.max(k, 0.05), ms);
    };
    fit();
    // The canvas has not always been laid out on the first call, so fit once more a moment later.
    const t = setTimeout(fit, 250);
    return () => clearTimeout(t);
  }, [selectedRingId, graphData, built, size]);

  const ease = () => {
    const a = anim.current;
    const t = target.current;
    a.focus += ((t.selected ? 1 : 0) - a.focus) * 0.12;
    a.grey += (t.grey - a.grey) * 0.1;
    for (const [id, f] of built.flow) {
      const goal = t.selected === id ? 1 : 0;
      if (f.blend === goal) continue;
      f.blend += (goal - f.blend) * 0.14;
      if (Math.abs(goal - f.blend) < 0.003) f.blend = goal;
      const e = f.blend * f.blend * (3 - 2 * f.blend); // smoothstep
      for (const n of f.nodes) {
        n.x = n.wx + (n.lx - n.wx) * e;
        n.y = n.wy + (n.ly - n.wy) * e;
        n.fx = n.x;
        n.fy = n.y;
      }
    }
  };

  const drawNode = (node, ctx, scale) => {
    const { focus, grey } = anim.current;
    const sel = target.current.selected;
    const inRing = !!node.ringId;
    const isSel = inRing && node.ringId === sel;
    const hub = isHub(node);
    if (inRing && !node.shown && !isSel) return;

    // Alpha: background stars are faint; when a ring is selected, everything else dims toward DIM_ALPHA.
    const base = inRing ? 1 : 0.4;
    const alpha = isSel ? 1 : base * (1 - focus * (1 - DIM_ALPHA / base));

    // Selected ring: detailed network view. Beneficiaries = teal ringed circles, shared items = red warning
    // triangles with a small caption. Sizes are in screen pixels (1/scale) so they stay readable at any zoom.
    if (isSel) {
      const px = 1 / scale;
      const deflagged = node.status === 'deflagged';
      const col = mix(hub ? palette.red : palette.teal, palette.muted, grey);
      ctx.save();
      if (!deflagged) {
        ctx.shadowColor = rgba(col, 1);
        ctx.shadowBlur = 14;
      }
      let bottom;
      if (hub) {
        const r = 12 * px;
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
        bottom = node.y + r * 0.7;
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
        bottom = node.y + r + 3 * px;
      }
      ctx.restore();

      // Caption: the shared item's value (e.g. "SBI ****6525"), or the beneficiary's first name.
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = rgba(hub ? palette.text : palette.muted, 1);
      ctx.font = `${10 * px}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(hub ? clip(node.label, 20) : clip(node.label.split(' ')[0], 12), node.x, bottom + 3 * px);
      ctx.restore();
      return;
    }

    let col = inRing ? colorOf(node.ringId) : palette.muted;
    if (inRing) col = mix(col, palette.muted, grey);

    const r = inRing ? (hub ? 5 : 3.2) : 1.1;
    const deflagged = node.status === 'deflagged';

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (inRing && !deflagged) {
      ctx.shadowColor = rgba(col, 1);
      ctx.shadowBlur = 8 * (1 - grey * 0.8);
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
    if (node.ringId && !node.shown && node.ringId !== target.current.selected) return;
    const r = node.ringId ? Math.min(9, 12 / scale) : 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();
  };

  const ringOf = (l) => (typeof l.source === 'object' ? l.source.ringId : null);

  const linkColor = (l) => {
    const ringId = ringOf(l);
    if (!ringId) return rgba(palette.faint, 0.35);
    const { focus, grey } = anim.current;
    if (l.cross) return rgba(mix(edgeRgb(l.type), palette.muted, grey), 0.55 * (1 - focus));
    const sel = target.current.selected;
    // Selected ring: each link coloured by what it shows (account, phone, IP, ...); money flow stays red.
    if (sel === ringId) {
      const inFlow = !!built.flow.get(ringId)?.isFlow;
      return rgba(edgeRgb(l.type), l.type === 'transfer' ? 0.95 : inFlow ? 0.5 : 0.85);
    }
    const a = 0.2 * (1 - focus + focus * DIM_ALPHA * 0.5);
    return rgba(mix(colorOf(ringId), palette.muted, grey), a);
  };

  // Money transfers get thicker the more rupees they carry.
  const linkWidth = (l) => {
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    const ringId = ringOf(l);
    if (ringId && ringId === target.current.selected) {
      return (l.type === 'transfer' ? 1.6 + 4.4 * (l.amtShare || 0) : 1.8) / zoom;
    }
    return l.cross ? 1 : 0.6;
  };

  const linkDash = (l) => {
    if (l.type !== 'similarName' || ringOf(l) !== selectedRingId) return null;
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    return [6 / zoom, 5 / zoom];
  };

  // Look-alike names arc outside the wheel; in the flow layout, payback transfers arch over the collector.
  const linkCurvature = (l) => {
    if (l.type === 'similarName') return 0.35;
    if (l.type === 'transfer' && typeof l.source === 'object') {
      const back = l.source.type !== 'beneficiary' && l.target.type === 'beneficiary';
      return back ? 0.45 : 0.08;
    }
    return 0;
  };

  const arrowLength = (l) => {
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    return l.type === 'transfer' && ringOf(l) === selectedRingId ? 10 / zoom : 0;
  };

  // Animated dots travelling along money transfers show the direction and pace of the flow.
  const particles = (l) => (l.type === 'transfer' && ringOf(l) === selectedRingId ? 3 : 0);
  const particleWidth = () => {
    const zoom = (fgRef.current && fgRef.current.zoom()) || 1;
    return 3.5 / zoom;
  };

  const linkVisible = (l) => {
    if (l.cross) return !selectedRingId && l.source.shown && l.target.shown;
    if (ringOf(l) === selectedRingId) return !hiddenTypes.has(l.type);
    return !l.source.ringId || l.source.shown;
  };

  // The ring itself: a circle through all of its nodes (overview).
  const drawOutlines = (ctx, scale) => {
    const { focus, grey } = anim.current;
    const sel = target.current.selected;
    ctx.save();
    ctx.lineWidth = 2 / Math.max(scale, 0.5);
    for (const o of built.outlines) {
      const f = built.flow.get(o.id);
      const own = sel === o.id ? 1 - f.blend : 1 - focus * (1 - DIM_ALPHA);
      if (own <= 0.01) continue;
      ctx.globalAlpha = 0.85 * own;
      ctx.strokeStyle = rgba(mix(colorOf(o.id), palette.muted, grey), 1);
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.rim, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Column captions for the layered flow layout.
  const drawCaptions = (ctx, scale) => {
    const f = built.flow.get(target.current.selected);
    if (!f || f.blend < 0.85) return;
    const px = 1 / scale;
    ctx.save();
    ctx.globalAlpha = (f.blend - 0.85) / 0.15;
    ctx.fillStyle = rgba(palette.muted, 1);
    ctx.font = `600 ${11 * px}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const c of f.cols) ctx.fillText(c.label.toUpperCase(), c.x, c.y);
    ctx.restore();
  };

  const tooltip = (n) =>
    `<div style="background:#040D1F;border:1px solid ${rgba(palette.faint, 1)};padding:6px 10px;border-radius:6px;font-size:12px">
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
        backgroundColor="#040D1F"
        nodeRelSize={4}
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => 'replace'}
        nodePointerAreaPaint={pointerArea}
        nodeLabel={tooltip}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkLineDash={linkDash}
        linkVisibility={linkVisible}
        linkDirectionalParticles={particles}
        linkDirectionalParticleSpeed={0.007}
        linkDirectionalParticleWidth={particleWidth}
        linkDirectionalParticleColor={() => rgba(palette.text, 1)}
        onRenderFramePost={drawCaptions}
        linkCurvature={linkCurvature}
        linkDirectionalArrowLength={arrowLength}
        linkDirectionalArrowRelPos={0.92}
        linkDirectionalArrowColor={() => rgba(palette.red, 1)}
        autoPauseRedraw={false}
        onRenderFramePre={(ctx, scale) => { ease(); drawOutlines(ctx, scale); }}
        warmupTicks={0}
        cooldownTicks={0}
        enableNodeDrag={false}
        onNodeClick={(n) => onSelectRing(n.ringId || null)}
        onBackgroundClick={() => onSelectRing(null)}
      />
      {legendTypes.length > 0 && (
        <div className="edge-legend">
          {legendTypes.map(([type, count]) => {
            const off = hiddenTypes.has(type);
            return (
              <button
                key={type}
                className={`edge-chip ${off ? 'off' : ''}`}
                title={off ? 'Show these links' : 'Hide these links'}
                onClick={() => setHiddenTypes((cur) => { const next = new Set(cur); if (next.has(type)) next.delete(type); else next.add(type); return next; })}
              >
                <span className="edge-swatch" style={{ background: rgba(edgeRgb(type), 1) }} />
                {EDGE_LABELS[type] || type} <em>{count}</em>
              </button>
            );
          })}
        </div>
      )}
      <div className="graph-hint">{selectedRingId ? `${selectedRingId} · click empty space to reset` : `Top ${VISIBLE_RINGS} rings by risk · click one, or pick any ring from the list`}</div>
    </div>
  );
}
