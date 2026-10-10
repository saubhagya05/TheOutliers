// Dataset choice. DatasetPicker = the small section on the landing page (use ours or upload a CSV).
// RequireDataset wraps /analyse, /rings and /lone: without a choice this session, it sends the user to the landing page;
// with one, it shows a slim "Dataset: … · Change" bar above the page.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getActiveDataset, useBuiltinDataset, uploadDataset } from '../api/client.js';
import { ErrorBox, Loading } from './States.jsx';
import './datasetGate.css';

const KEY = 'outliers.dataset';
export const rememberedDataset = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const rememberDataset = (id) => {
  try { if (id) sessionStorage.setItem(KEY, id); else sessionStorage.removeItem(KEY); } catch { /* private mode */ }
};

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

const OUR_LINE = '20,000 simulated scholarship beneficiaries and 17,667 money transfers, with 31 planted fraud rings and 240 lone ghosts whose answers we know.';

export function DatasetPicker({ onChosen, onStart, onFail }) {
  const [active, setActive] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [transfers, setTransfers] = useState(null);
  const [busy, setBusy] = useState(null); // 'builtin' | 'upload'
  const [error, setError] = useState(null);

  useEffect(() => { getActiveDataset().then(setActive).catch(() => setActive(null)); }, []);
  const builtin = active && active.dataset && active.dataset.source === 'builtin' ? active.dataset : null;

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    if (onStart) onStart(kind);
    try {
      const { dataset } = await fn();
      rememberDataset(dataset.id);
      onChosen(dataset);
    } catch (e) {
      setError(e);
      if (onFail) onFail(e);
    } finally {
      setBusy(null);
    }
  };

  const useOurs = () => run('builtin', () => useBuiltinDataset());
  const upload = () => run('upload', async () => uploadDataset({
    name: ledger.name.replace(/\.csv$/i, ''),
    ledgerCsv: await ledger.text(),
    transfersCsv: transfers ? await transfers.text() : '',
  }));

  return (
    <section className="picker" aria-label="Choose a dataset">
      <div className="picker-row">
        <div className="picker-opt">
          <div className="picker-head"><strong>Use our dataset</strong></div>
          <p>{builtin ? builtin.description : OUR_LINE}</p>
          <button className="btn btn-primary" disabled={!!busy} onClick={useOurs}>
            {busy === 'builtin' ? 'Loading…' : 'Use our dataset →'}
          </button>
        </div>

        <div className="picker-or">or</div>

        <div className="picker-opt">
          <div className="picker-head">
            <strong>Upload your own</strong>
            <span className="picker-links">
              templates: <button type="button" onClick={() => downloadTemplate('ledger_template.csv', LEDGER_COLUMNS)}>ledger</button>
              · <button type="button" onClick={() => downloadTemplate('transfers_template.csv', TRANSFER_COLUMNS)}>transfers</button>
            </span>
          </div>
          <label className="picker-file">
            <span>Ledger CSV</span>
            <input type="file" accept=".csv,text/csv" disabled={!!busy} onChange={(e) => setLedger(e.target.files[0] || null)} />
          </label>
          <label className="picker-file">
            <span>Transfers <em>optional</em></span>
            <input type="file" accept=".csv,text/csv" disabled={!!busy} onChange={(e) => setTransfers(e.target.files[0] || null)} />
          </label>
          <button className="btn" disabled={!ledger || !!busy || (active && active.canUpload === false)} onClick={upload}>
            {busy === 'upload' ? 'Analysing your data…' : 'Upload & analyse →'}
          </button>
          {active && active.canUpload === false && <span className="picker-warn">Uploads need the ML service (live mode).</span>}
        </div>
      </div>
      {error && <ErrorBox error={error} />}
    </section>
  );
}

export default function RequireDataset({ children, bar = true }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, dataset: null, error: null });
  const chosen = rememberedDataset();

  useEffect(() => {
    getActiveDataset()
      .then((a) => setState({ loading: false, dataset: a.dataset, error: null }))
      .catch((error) => setState({ loading: false, dataset: null, error }));
  }, []);

  if (!chosen) return <Navigate to="/" replace />;
  if (state.error) return <ErrorBox error={state.error} />;
  if (state.loading) return <Loading label="Checking dataset" />;
  // The active dataset changed (e.g. another tab uploaded one): choose again.
  if (!state.dataset || state.dataset.id !== chosen) return <Navigate to="/" replace />;

  const d = state.dataset;
  return (
    <>
      {bar && (
        <div className="gate-bar">
          <span className="row" style={{ gap: 12 }}>
            {/* Back to "Choose an analysis" with the same dataset (no need to pick it again). */}
            <button className="btn" onClick={() => navigate('/analyse')}>← Back</button>
            <span>Dataset: <strong>{d.name}</strong> · {d.recordCount.toLocaleString('en-IN')} records
              {d.source === 'upload' && <span className="gate-tag small">uploaded</span>}</span>
          </span>
          <button className="btn" onClick={() => { rememberDataset(null); navigate('/'); }}>Change dataset</button>
        </div>
      )}
      {children}
    </>
  );
}
