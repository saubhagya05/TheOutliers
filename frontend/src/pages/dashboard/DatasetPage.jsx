// OWNER: Dashboard. Spec: docs/TASKS.md "Person A".
// Dataset card, columns used, how it was created, planted fraud, pipeline steps, benchmarks, limitations.
import { getDataset, getBenchmarks } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import DatasetCard from './components/DatasetCard.jsx';
import BenchmarkTable from './components/BenchmarkTable.jsx';

export default function DatasetPage() {
  const dataset = useApi(() => getDataset(), []);
  const bench = useApi(() => getBenchmarks(), []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 24 }}>
      <h1>Dataset & method</h1>
      <ErrorBox error={dataset.error} onRetry={dataset.reload} />
      {dataset.loading ? <Loading /> : dataset.data && <DatasetCard dataset={dataset.data} />}
      <ErrorBox error={bench.error} onRetry={bench.reload} />
      {bench.data && <BenchmarkTable benchmarks={bench.data} />}
    </div>
  );
}
