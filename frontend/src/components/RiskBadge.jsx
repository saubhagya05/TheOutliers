// Shared. <RiskBadge score={91} level="high" />
export default function RiskBadge({ score, level }) {
  const color = `var(--risk-${level || 'low'})`;
  return (
    <span className="mono" style={{ color, border: `1px solid ${color}`, borderRadius: 6, padding: '1px 6px', fontSize: 12 }}>
      {score}
    </span>
  );
}
