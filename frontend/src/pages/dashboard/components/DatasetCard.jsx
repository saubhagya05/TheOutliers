// OWNER: Dashboard. Props: dataset = GET /api/dataset response.
const nice = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  .replace(/\bIp\b/g, 'IP').replace(/\bUpi\b/g, 'UPI').replace(/\bCsc\b/g, 'CSC');
const fmt = (n) => (n ?? 0).toLocaleString('en-IN');

function Chips({ items }) {
  return <span className="ds-chips">{items.map((u) => <span key={u} className={`ds-chip ${u}`}>{u}</span>)}</span>;
}

export default function DatasetCard({ dataset: d }) {
  const p = d.planted;
  const heldOut = p.ringTypes.filter((t) => t.heldOut).length;
  const tiles = [
    [fmt(d.recordCount), 'beneficiary records'],
    [fmt(d.transferCount), 'money transfers'],
    [p.rings, 'rings planted'],
    [p.loneGhosts, 'lone ghosts planted'],
    [`${p.ringTypes.length}`, `ring types (${heldOut} held out)`],
  ];

  return (
    <>
      <section>
        <div className="ds-label">The data {d.simulated && <span className="ds-badge">simulated</span>}</div>
        <div className="ds-tiles">
          {tiles.map(([v, l]) => <div key={l} className="ds-tile"><strong>{v}</strong><span>{l}</span></div>)}
        </div>
        <p className="ds-note">Real fraud labels are not public, so we built a ledger with known answers, then checked our methods on public data too.</p>
      </section>

      <section className="ds-grid">
        <div>
          <div className="ds-label">What each record holds</div>
          <table className="ds-table">
            <thead><tr><th>Group</th><th>Fields</th><th>Used for</th></tr></thead>
            <tbody>
              {d.columnGroups.map((g) => g.columns.map((c, i) => (
                <tr key={g.group + c.name}>
                  {i === 0 && <td rowSpan={g.columns.length} className="ds-group">{g.group.replace(/ \(.*\)/, '')}</td>}
                  <td className="mono">{c.name}</td>
                  <td><Chips items={c.usedFor} /></td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>

        <div className="ds-stack">
          <div>
            <div className="ds-label">Fraud we planted</div>
            <table className="ds-table">
              <thead><tr><th>Ring type</th><th className="num">Rings</th><th /></tr></thead>
              <tbody>
                {p.ringTypes.map((t) => (
                  <tr key={t.type} title={t.description}>
                    <td>{nice(t.type)}</td>
                    <td className="num mono">{t.count}</td>
                    <td>{t.heldOut && <span className="ds-chip held">held out</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="ds-label">Look-alikes that must <em>not</em> be flagged</div>
            <table className="ds-table">
              <tbody>
                {p.hardNegatives.map((h) => (
                  <tr key={h.type} title={h.description}>
                    <td>{nice(h.type)}</td>
                    <td className="num mono">{fmt(h.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <div className="ds-label">How detection works</div>
        <ol className="ds-steps">
          {d.pipeline.map((s, i) => (
            <li key={s.step} title={s.description}>
              <span className="ds-step-n">{i + 1}</span>
              <strong>{s.step}</strong>
              <span>{s.description}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
