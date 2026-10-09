// OWNER: Dashboard. Props: benchmarks = GET /api/benchmarks response. Optional fields may be missing.
const nice = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  .replace(/\bIp\b/g, 'IP').replace(/\bUpi\b/g, 'UPI').replace(/\bCsc\b/g, 'CSC');
const pct = (v) => (v === null || v === undefined ? '–' : v.toFixed(2));

function Kpi({ value, label, sub, accent }) {
  return (
    <div className={`ds-kpi ${accent ? 'accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export default function BenchmarkTable({ benchmarks: b }) {
  const test = b.testSet || b.simulatedLedger;
  const r = test.rings;
  const l = test.lone;
  const scale = b.scaleRun;

  return (
    <>
      <section>
        <div className="ds-label">Results on the held-out test set <span className="ds-badge">never used for tuning</span></div>
        <div className="ds-kpis">
          <Kpi accent value={`${r.found}/${r.planted}`} label="rings found" sub={`F1 ${pct(r.f1)} · ${r.falseAlerts} false alarm${r.falseAlerts === 1 ? '' : 's'}`} />
          <Kpi value="0" label="rings a unique-ID check finds" sub="the blind spot we close" />
          <Kpi value={pct(l.f1)} label="lone-ghost F1" sub={`precision ${pct(l.precision)} · recall ${pct(l.recall)}`} />
          {scale && <Kpi value={`${Math.round(scale.records / 1000)}k`} label={`records in ${Math.round(scale.seconds)} s`} sub={`${scale.recordsPerSecond.toLocaleString('en-IN')} records / second`} />}
        </div>
      </section>

      <section className="ds-grid">
        {test.byRingType && (
          <div>
            <div className="ds-label">Rings found by type</div>
            <table className="ds-table">
              <thead><tr><th>Ring type</th><th className="num">Found</th></tr></thead>
              <tbody>
                {test.byRingType.map((t) => (
                  <tr key={t.type}>
                    <td>{nice(t.type)} {t.heldOut && <span className="ds-chip held">held out</span>}</td>
                    <td className="num mono">
                      <span className={t.found === t.planted ? 'ds-ok' : 'ds-warn'}>{t.found}/{t.planted}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <div className="ds-label">Checked on public benchmark data</div>
          <table className="ds-table">
            <thead><tr><th>Dataset</th><th>What it tests</th><th className="num">Precision</th><th className="num">Recall</th><th className="num">Score</th></tr></thead>
            <tbody>
              {b.public.map((p) => (
                <tr key={p.dataset + p.component} title={p.note}>
                  <td className="mono">{p.dataset.replace(' (HI-Small)', '')}</td>
                  <td>{p.component.replace(' (record linkage)', '')}</td>
                  <td className="num mono">{pct(p.precision)}</td>
                  <td className="num mono">{pct(p.recall)}</td>
                  <td className="num mono">
                    {p.f1 !== null && p.f1 !== undefined ? `F1 ${pct(p.f1)}` : p.liftOverRandom ? `${p.liftOverRandom}× random` : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ds-note">Febrl: identity matching (a unique-key check finds only 90–96% of these duplicates). IBM AML: money-flow detection on 4.5M transfers, no tuning.</p>
        </div>
      </section>

      <section>
        <div className="ds-label">Honest limits</div>
        <ul className="ds-limits">
          <li>Ring and lone results are on our simulated ledger.</li>
          <li>Febrl is a clean public benchmark; IBM AML is synthetic and has no identity data.</li>
          <li>Fan-in alone is a weak signal, so we only flag collectors together with other evidence.</li>
        </ul>
      </section>
    </>
  );
}
