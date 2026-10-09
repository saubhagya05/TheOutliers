// Shown before the Ring / Lone pages: use our dataset or upload your own. The choice is remembered for this
// browser session; the bar above the page shows the active dataset and lets the user change it.
import { useEffect, useState } from 'react';
import { getActiveDataset, useBuiltinDataset, uploadDataset } from '../api/client.js';
import { ErrorBox, Loading } from './States.jsx';
import './datasetGate.css';

const KEY = 'outliers.dataset';
const remembered = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const remember = (id) => { try { if (id) sessionStorage.setItem(KEY, id); else sessionStorage.removeItem(KEY); } catch { /* private mode */ } };

const LEDGER_COLUMNS = [
  'beneficiary_id', 'application_id', 'scheme', 'full_name', 'father_name', 'spouse_name', 'gender', 'dob', 'age',
  'aadhaar_number', 'aadhaar_status', 'biometric_hash', 'phone', 'email', 'address_line', 'village_town', 'district',
  'state', 'pincode', 'registration_ip', 'registration_channel', 'registration_ts', 'application_ts', 'bank_name',
  'bank_account_number', 'ifsc', 'upi_id', 'payout_mode', 'amount_inr', 'payout_ts', 'login_attempts_failed',
  'login_success', 'login_window_minutes',
];
const TRANSFER_COLUMNS = ['transfer_id', 'from_account', 'to_account', 'amount_inr', 'ts', 'channel'];

function downloadTemplate(name, columns) {
  const url = URL.createObjectURL(new Blob([`${columns.join(',')}\n`], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function Chooser({ active, onChosen }) {
  const [ledger, setLedger] = useState(null);
  const [transfers, setTransfers] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(null); // 'builtin' | 'upload'
  const [error, setError] = useState(null);
  const builtin = active && active.dataset && active.dataset.source === 'builtin' ? active.dataset : null;

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    try {
      onChosen((await fn()).dataset);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const useOurs = () => run('builtin', () => useBuiltinDataset());
  const upload = () => run('upload', async () => uploadDataset({
    name: name || (ledger && ledger.name.replace(/\.csv$/i, '')) || 'Uploaded dataset',
    ledgerCsv: await ledger.text(),
    transfersCsv: transfers ? await transfers.text() : '',
  }));

  return (
    <div className="gate">
      <header>
        <h1>Choose a dataset</h1>
        <p className="muted">Detection runs on the data you pick. You can change it later.</p>
      </header>

      <div className="gate-options">
        <section className="gate-card">
          <span className="gate-tag">Ready to explore</span>
          <h2>Use our dataset</h2>
          <p className="gate-line">
            {builtin ? builtin.description
              : '20,000 simulated scholarship beneficiaries and 17,667 money transfers, with 31 planted fraud rings and 240 lone ghosts whose answers we know.'}
          </p>
          <button className="btn btn-primary gate-go" disabled={!!busy} onClick={useOurs}>
            {busy === 'builtin' ? 'Loading…' : 'Use this dataset →'}
          </button>
        </section>

        <section className="gate-card">
          <span className="gate-tag">Your data</span>
          <h2>Upload your dataset</h2>
          <p className="gate-line">A beneficiary ledger as CSV, in our column format. Money transfers are optional.</p>

          <label className="gate-file">
            <span>Ledger CSV <em>required</em></span>
            <input type="file" accept=".csv,text/csv" disabled={!!busy} onChange={(e) => setLedger(e.target.files[0] || null)} />
          </label>
          <label className="gate-file">
            <span>Transfers CSV <em>optional, enables money-cycle detection</em></span>
            <input type="file" accept=".csv,text/csv" disabled={!!busy} onChange={(e) => setTransfers(e.target.files[0] || null)} />
          </label>
          <input className="gate-name" placeholder="Dataset name (optional)" value={name} disabled={!!busy} onChange={(e) => setName(e.target.value)} />

          <div className="row gate-templates">
            <button className="btn" type="button" onClick={() => downloadTemplate('ledger_template.csv', LEDGER_COLUMNS)}>Ledger template</button>
            <button className="btn" type="button" onClick={() => downloadTemplate('transfers_template.csv', TRANSFER_COLUMNS)}>Transfers template</button>
          </div>

          {active && active.canUpload === false && (
            <p className="gate-warn">Uploads need the ML service running (live mode).</p>
          )}
          <button className="btn btn-primary gate-go" disabled={!ledger || !!busy} onClick={upload}>
            {busy === 'upload' ? 'Running detection on your data…' : 'Upload & analyse →'}
          </button>
        </section>
      </div>

      {busy === 'upload' && <Loading label="Linking records, building the graph and scoring rings. About 5 seconds per 20,000 records" />}
      <ErrorBox error={error} />
    </div>
  );
}

export default function DatasetGate({ children }) {
  const [active, setActive] = useState(null);
  const [error, setError] = useState(null);
  const [chosen, setChosen] = useState(remembered());

  useEffect(() => {
    getActiveDataset().then(setActive).catch(setError);
  }, [chosen]);

  if (error) return <ErrorBox error={error} onRetry={() => { setError(null); setChosen(remembered()); }} />;
  if (!active) return <Loading label="Checking dataset" />;

  const current = active.dataset;
  // Go straight in only if this session already chose the dataset that is active now.
  if (!chosen || !current || current.id !== chosen) {
    return <Chooser active={active} onChosen={(d) => { remember(d.id); setChosen(d.id); }} />;
  }

  return (
    <>
      <div className="gate-bar">
        <span>Dataset: <strong>{current.name}</strong> · {current.recordCount.toLocaleString('en-IN')} records
          {current.source === 'upload' && <span className="gate-tag small">uploaded</span>}</span>
        <button className="btn" onClick={() => { remember(null); setChosen(null); }}>Change dataset</button>
      </div>
      {children}
    </>
  );
}
