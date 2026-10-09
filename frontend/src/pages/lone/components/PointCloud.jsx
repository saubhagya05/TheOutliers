
import { useState } from 'react';

export default function PointCloud({ data, selectedId, onSelect }) {
  const [hoveredId, setHoveredId] = useState(null);

  const points = data?.points ?? [];
  const axes = data?.axes ?? {
    x: 'Behaviour projection 1',
    y: 'Behaviour projection 2',
  };

  const width = 640;
  const height = 420;
  const padding = { top: 28, right: 24, bottom: 58, left: 62 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const position = (point) => ({
    x: padding.left + point.x * plotWidth,
    y: padding.top + (1 - point.y) * plotHeight,
  });

  const radius = (point) => {
    if (point.status === 'deflagged') return 4;
    if (point.status === 'confirmed') return 7;
    if (point.flagged || point.status === 'flagged') {
      return 4 + (Math.max(0, Math.min(100, point.riskScore ?? 0)) / 100) * 5;
    }
    return 2;
  };

  const isSuspicious = (point) =>
    point.flagged ||
    point.status === 'flagged' ||
    point.status === 'confirmed';

  const tooltipPoint = points.find(
    (point) => point.recordId === hoveredId
  );

  return (
    <section
      style={{
        background: '#080808',
        color: '#f5f5f5',
        border: '1px solid #303030',
        borderRadius: 10,
        padding: 16,
        minWidth: 0,
      }}
    >
      <style>{`
        @keyframes point-pulse {
          0%, 100% { opacity: 1; stroke-width: 2; }
          50% { opacity: .55; stroke-width: 5; }
        }

        .point-selected {
          animation: point-pulse 1.5s ease-in-out infinite;
        }

        .cloud-point:focus {
          outline: none;
        }

        .cloud-point:focus-visible {
          stroke: white;
          stroke-width: 3;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Beneficiary point cloud</h2>
          <p style={{ color: '#999', fontSize: 12, margin: '6px 0 0' }}>
            Select a point to inspect its risk and evidence.
          </p>
        </div>

        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#bbb' }}>
          {points.length} RECORDS
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Scatter plot of beneficiary records by behavioural projection"
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            background: '#050505',
            border: '1px solid #252525',
            borderRadius: 6,
          }}
          onClick={() => onSelect(null)}
        >
          <defs>
            <filter id="point-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const x = padding.left + tick * plotWidth;
            const y = padding.top + (1 - tick) * plotHeight;

            return (
              <g key={tick} pointerEvents="none">
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke="#242424"
                  strokeWidth="1"
                />
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#242424"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fill="#777"
                  fontSize="10"
                >
                  {tick.toFixed(2)}
                </text>
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#777"
                  fontSize="10"
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#777"
          />
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#777"
          />

          <text
            x={padding.left + plotWidth / 2}
            y={height - 12}
            textAnchor="middle"
            fill="#ccc"
            fontSize="12"
          >
            {axes.x}
          </text>

          <text
            transform={`translate(17 ${padding.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="#ccc"
            fontSize="12"
          >
            {axes.y}
          </text>

          {points.map((point) => {
            const { x, y } = position(point);
            const selected = selectedId === point.recordId;
            const dimmed = selectedId && !selected;
            const deflagged = point.status === 'deflagged';
            const confirmed = point.status === 'confirmed';
            const suspicious = isSuspicious(point);

            let fill = '#858585';
            let stroke = 'none';

            if (deflagged) {
              fill = 'transparent';
              stroke = '#888';
            } else if (confirmed) {
              fill = '#ff3434';
              stroke = '#fff';
            } else if (suspicious) {
              fill = '#ff3434';
              stroke = selected ? '#fff' : '#ff7777';
            }

            return (
              <circle
                key={point.recordId}
                className={`cloud-point${selected ? ' point-selected' : ''}`}
                cx={x}
                cy={y}
                r={selected ? radius(point) + 2 : radius(point)}
                fill={fill}
                stroke={stroke}
                strokeWidth={confirmed || deflagged || selected ? 2 : 0.8}
                opacity={dimmed ? 0.12 : deflagged ? 0.65 : suspicious ? 0.95 : 0.35}
                filter={suspicious && !deflagged ? 'url(#point-glow)' : undefined}
                tabIndex={0}
                role="button"
                aria-label={`${point.recordId}, risk ${point.riskScore}, ${point.status}`}
                onMouseEnter={(event) => {
                  event.currentTarget.style.cursor = 'pointer';
                  setHoveredId(point.recordId);
                }}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(point.recordId)}
                onBlur={() => setHoveredId(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelect(point.recordId);
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(point.recordId);
                }}
              />
            );
          })}
        </svg>

        {tooltipPoint && (
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: 10,
              maxWidth: '85%',
              padding: '10px 12px',
              background: '#171717',
              border: '1px solid #444',
              borderRadius: 6,
              pointerEvents: 'none',
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontWeight: 700, color: '#fff' }}>
              {tooltipPoint.recordId}
            </div>
            <div>
              Risk: <span style={{ color: '#ff4545' }}>
                {tooltipPoint.riskScore}/100
              </span>
            </div>
            <div>Status: {tooltipPoint.status}</div>
            <div>Signal: {tooltipPoint.topSignal || 'None'}</div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 14,
          fontSize: 12,
          color: '#bbb',
        }}
      >
        <span><span style={{ color: '#ff3434' }}>●</span> Flagged</span>
        <span><span style={{ color: '#fff' }}>◉</span> Confirmed</span>
        <span><span style={{ color: '#999' }}>○</span> Deflagged</span>
        <span><span style={{ color: '#858585' }}>·</span> Normal</span>
      </div>

      {points.length === 0 && (
        <p style={{ color: '#aaa', fontSize: 13 }}>
          No points to display. Try refreshing the data.
        </p>
      )}
    </section>
  );
}
