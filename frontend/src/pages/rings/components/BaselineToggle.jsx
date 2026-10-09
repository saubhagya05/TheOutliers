// OWNER: Ring. Props: on (bool), onChange(bool).
// TODO(ring): when on, also show a small overlay with GET /api/baseline numbers
// ("Unique-ID check: 0 rings found" vs "Our graph: 13 rings").
export default function BaselineToggle({ on, onChange }) {
  return (
    <button className={`btn ${on ? 'btn-active' : ''}`} onClick={() => onChange(!on)}>
      {on ? 'Showing: unique-ID check' : 'Compare with unique-ID check'}
    </button>
  );
}
