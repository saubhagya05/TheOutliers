// Landing-page effect: white lines trace outward from just below the dataset section, branch, and end in
// glowing red dots. Draws on a transparent canvas from `top` (px) to the bottom of its (position: relative)
// parent. onTraced() fires once all lines have arrived; the red dots keep pulsing after that.
import { useEffect, useRef } from 'react';

const TRACE_MS = 2200;

const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
const ease = (t) => 1 - Math.pow(1 - t, 3);

// One wandering path from (x, y): a handful of segments with small random turns.
function makePath(x, y, angle, length, steps) {
  const pts = [{ x, y }];
  const seg = length / steps;
  let a = angle;
  for (let i = 0; i < steps; i += 1) {
    a += (Math.random() - 0.5) * 0.6;
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
    pts.push({ x, y });
  }
  return pts;
}

// Distance from (x, y) to the canvas border along `angle`, so lines end inside the area.
function room(x, y, angle, w, h) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const tx = dx > 0 ? (w - x) / dx : dx < 0 ? -x / dx : Infinity;
  const ty = dy > 0 ? (h - y) / dy : dy < 0 ? -y / dy : Infinity;
  return Math.min(tx, ty);
}

// Lines fan out downward from the top-centre of the canvas (just below the dataset section).
function buildLines(w, h) {
  const cx = w / 2;
  const lines = [];
  const main = 44;
  for (let i = 0; i < main; i += 1) {
    const angle = 0.12 + (i / (main - 1)) * (Math.PI - 0.24) + (Math.random() - 0.5) * 0.06;
    const length = Math.min(room(cx, 0, angle, w, h) * 0.92, Math.hypot(w, h) * 0.6) * (0.45 + Math.random() * 0.55);
    const path = makePath(cx, 0, angle, length, 6 + Math.floor(Math.random() * 5));
    lines.push({ path, delay: Math.random() * 0.25, dur: 0.5 + Math.random() * 0.25 });
    // Branch off the middle of the path, so lines end at many different points.
    if (Math.random() < 0.75) {
      const at = Math.floor(path.length * (0.35 + Math.random() * 0.3));
      const from = path[at];
      const side = angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.7);
      const len = Math.min(room(from.x, from.y, side, w, h) * 0.9, length * 0.7) * (0.4 + Math.random() * 0.6);
      lines.push({ path: makePath(from.x, from.y, side, Math.max(len, 10), 4 + Math.floor(Math.random() * 3)), delay: 0.2 + Math.random() * 0.3, dur: 0.35 + Math.random() * 0.2 });
    }
  }
  return lines;
}

// The polyline cut at fraction f (0-1) of its length.
function partial(path, f) {
  const lens = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const l = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    lens.push(l);
    total += l;
  }
  let want = total * f;
  const out = [path[0]];
  for (let i = 0; i < lens.length; i += 1) {
    if (want >= lens[i]) {
      out.push(path[i + 1]);
      want -= lens[i];
    } else {
      const r = want / lens[i];
      out.push({ x: path[i].x + (path[i + 1].x - path[i].x) * r, y: path[i].y + (path[i + 1].y - path[i].y) * r });
      break;
    }
  }
  return out;
}

// The last traced lines, kept so "Choose an analysis" can redraw the same threads after the page changes.
// offset = where the canvas top sits relative to the next page (set by LandingPage).
export const traceMemory = { lines: null, w: 0, h: 0, offset: 0 };

// settled: draw the remembered lines fully arrived (no animation), sized and placed as before.
export default function TraceTransition({ onTraced = () => {}, top = 0, settled = false }) {
  const canvasRef = useRef(null);
  const tracedRef = useRef(onTraced);
  tracedRef.current = onTraced;

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tracedRef.current();
      return undefined;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reuse = settled && traceMemory.lines;
    const w = reuse ? traceMemory.w : canvas.clientWidth;
    const h = reuse ? traceMemory.h : canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const white = cssVar('--text', '#f5f5f5');
    const red = cssVar('--red', '#ff2d2d');
    const lines = reuse ? traceMemory.lines : buildLines(w, h);
    if (!settled) Object.assign(traceMemory, { lines, w, h });
    // Settled: start "in the past" so every line has already arrived and only the red dots pulse.
    const start = performance.now() - (settled ? TRACE_MS * 2 : 0);
    let raf = 0;
    let told = false;

    const frame = (now) => {
      const ms = now - start;
      const trace = ms / TRACE_MS;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const ln of lines) {
        const p = Math.min(1, Math.max(0, (trace - ln.delay) / ln.dur));
        if (p <= 0) continue;
        const pts = partial(ln.path, ease(p));
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = white;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();

        const tip = pts[pts.length - 1];
        if (p < 1) {
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = white;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Arrived: a red dot that pulses in and keeps glowing.
          const age = Math.min(1, (trace - ln.delay - ln.dur) / 0.12);
          const pulse = 1 + 0.25 * Math.sin(ms / 160 + tip.x);
          ctx.globalAlpha = Math.max(0, age);
          ctx.fillStyle = red;
          ctx.shadowColor = red;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 3 * Math.min(1, age + 0.3) * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1;

      if (trace >= 1.05 && !told) {
        told = true;
        tracedRef.current();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={settled && traceMemory.lines
        ? { position: 'absolute', left: 0, top: `${top}px`, width: `${traceMemory.w}px`, height: `${traceMemory.h}px`, pointerEvents: 'none', zIndex: 0 }
        : { position: 'absolute', left: 0, right: 0, top: `${top}px`, width: '100%', height: `calc(100% - ${top}px)`, pointerEvents: 'none', zIndex: 0 }}
    />
  );
}
