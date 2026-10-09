
import { NavLink } from 'react-router-dom';

export default function TopNav() {
  const linkStyle = ({ isActive }) => ({
    textDecoration: 'none',
    color: isActive ? 'var(--text)' : 'var(--muted)',
    borderBottom: isActive
      ? '1px solid var(--red)'
      : '1px solid transparent',
    paddingBottom: 4,
  });

  return (
    <header className="top-nav">
      <div className="nav-left">
        <strong className="nav-logo">
          THE<span>OUTLIERS</span>
        </strong>

        <NavLink to="/" end style={linkStyle}>
          Home
        </NavLink>
      </div>

      <NavLink to="/dataset" className="nav-dataset" style={linkStyle}>
        Dataset &amp; method
      </NavLink>
    </header>
  );
}
