// OWNER: Dashboard. Props: benchmarks = GET /api/benchmarks response. `public` may be empty.
import { Todo } from '../../../components/States.jsx';

export default function BenchmarkTable({ benchmarks }) {
  const s = benchmarks.simulatedLedger;
  return (
    <Todo name="BenchmarkTable">
      {`Simulated ledger: rings P=${s.rings.precision} R=${s.rings.recall} F1=${s.rings.f1} | lone P=${s.lone.precision} R=${s.lone.recall} F1=${s.lone.f1}
Public benchmarks: ${benchmarks.public.length} rows (dataset, component, precision, recall, F1)
Notes: ${benchmarks.notes}
Render: two big F1 numbers + a table. Show "planted vs found vs false alerts".`}
    </Todo>
  );
}
