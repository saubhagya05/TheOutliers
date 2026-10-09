// Shared top bar. Owner: Dashboard (polish it), everyone uses it.
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/rings', label: 'Ring threats' },
  { to: '/lone', label: 'Lone threats' },
  { to: '/dataset', label: 'Dataset & method' },
];

export default function TopNav() {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', borderBottom: '1px solid var(--border)' }}>
      <strong style={{ letterSpacing: '0.08em' }}>
        THE<span style={{ color: 'var(--red)' }}>OUTLIERS</span>
      </strong>
      <nav className="row" style={{ gap: 20 }}>
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            style={({ isActive }) => ({ textDecoration: 'none', color: isActive ? 'var(--text)' : 'var(--muted)', borderBottom: isActive ? '1px solid var(--red)' : '1px solid transparent', paddingBottom: 2 })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
