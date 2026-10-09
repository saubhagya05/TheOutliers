// OWNER: Dashboard. Dataset & Method: what the data is, how detection works, how well it does.
import { getDataset, getBenchmarks } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import DatasetCard from './components/DatasetCard.jsx';
import BenchmarkTable from './components/BenchmarkTable.jsx';
import './dataset.css';

export default function DatasetPage() {
  const dataset = useApi(() => getDataset(), []);
  const bench = useApi(() => getBenchmarks(), []);

  return (
    <div className="ds-page">
      <header>
        <h1>Dataset &amp; method</h1>
        <p className="muted">What we tested on, how detection works, and how well it performs.</p>
      </header>
      <ErrorBox error={dataset.error} onRetry={dataset.reload} />
      {dataset.loading ? <Loading /> : dataset.data && <DatasetCard dataset={dataset.data} />}
      <ErrorBox error={bench.error} onRetry={bench.reload} />
      {bench.data && <BenchmarkTable benchmarks={bench.data} />}
    </div>
  );
}
