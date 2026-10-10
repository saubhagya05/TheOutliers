// OWNER: Ring. Spec: docs/TASKS.md "Person B".
// Layout: big constellation graph (left) + ring list / ring detail (right). Toolbar on top.
import { useState } from 'react';
import { getRingsGraph, getRings, getRing } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import ConstellationGraph from './components/ConstellationGraph.jsx';
import RingList from './components/RingList.jsx';
import RingDetailPanel from './components/RingDetailPanel.jsx';
import StressTestDrawer from './components/StressTestDrawer.jsx';
import './rings.css';

export default function RingsPage() {
  const [selectedRingId, setSelectedRingId] = useState(null);
  const [sort, setSort] = useState('riskScore'); // 'priorityScore' = the "Prioritise" button
  const [stressOpen, setStressOpen] = useState(false);

  const graph = useApi(() => getRingsGraph({ includeContext: true, contextNodes: 300 }), []);
  const rings = useApi(() => getRings({ sort, pageSize: 100 }), [sort]);
  const detail = useApi(() => (selectedRingId ? getRing(selectedRingId) : Promise.resolve(null)), [selectedRingId]);

  // After any flag/deflag, refresh everything that shows status or counts.
  const refreshAll = () => {
    graph.reload();
    rings.reload();
    detail.reload();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Ring threats</h1>
        <div className="row">
          <button className={`btn ${sort === 'priorityScore' ? 'btn-active' : ''}`} onClick={() => setSort(sort === 'priorityScore' ? 'riskScore' : 'priorityScore')}>
            Prioritise
          </button>
          <button className="btn" onClick={() => setStressOpen(true)}>Stress test</button>
        </div>
      </div>

      <ErrorBox error={graph.error || rings.error} onRetry={refreshAll} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(360px, 1fr)', gap: 16, minHeight: 600 }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#FAFBFD', position: 'relative' }}>
          {graph.loading && !graph.data ? <Loading label="Drawing constellation" /> : graph.data && (
            <ConstellationGraph
              data={graph.data}
              selectedRingId={selectedRingId}
              onSelectRing={setSelectedRingId}
            />
          )}
        </div>
        <div className="panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {selectedRingId ? (
            <RingDetailPanel
              ring={detail.data}
              loading={detail.loading}
              error={detail.error}
              onBack={() => setSelectedRingId(null)}
              onChanged={refreshAll}
            />
          ) : (
            rings.data && <RingList rings={rings.data.items} prioritised={sort === 'priorityScore'} onSelect={setSelectedRingId} onChanged={refreshAll} />
          )}
        </div>
      </div>

      {stressOpen && <StressTestDrawer onClose={() => setStressOpen(false)} />}
    </div>
  );
}
