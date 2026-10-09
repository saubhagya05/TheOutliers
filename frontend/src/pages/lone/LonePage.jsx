// OWNER: Lone. Spec: docs/TASKS.md "Person C".
// Layout: sparse point cloud (left) + lone list / record detail (right). Search on top.
import { useState } from 'react';
import { getLonePoints, getLone, getRecord } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import PointCloud from './components/PointCloud.jsx';
import LoneList from './components/LoneList.jsx';
import LoneDetailPanel from './components/LoneDetailPanel.jsx';
import RecordSearch from './components/RecordSearch.jsx';

export default function LonePage() {
  const [selectedId, setSelectedId] = useState(null);
  const [signal, setSignal] = useState(''); // filter by anomaly signal, '' = all

  const points = useApi(() => getLonePoints({ includeNormal: true, normalSample: 600 }), []);
  const lone = useApi(() => getLone({ pageSize: 100, signal }), [signal]);
  const detail = useApi(() => (selectedId ? getRecord(selectedId) : Promise.resolve(null)), [selectedId]);

  const refreshAll = () => {
    points.reload();
    lone.reload();
    detail.reload();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Lone threats</h1>
        <RecordSearch onSelect={setSelectedId} />
      </div>

      <ErrorBox error={points.error || lone.error} onRetry={refreshAll} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 1fr)', gap: 16, minHeight: 560 }}>
        <div className="panel" style={{ background: '#000' }}>
          {points.loading ? <Loading label="Plotting records" /> : points.data && (
            <PointCloud data={points.data} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
        <div className="panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {selectedId ? (
            <LoneDetailPanel record={detail.data} loading={detail.loading} error={detail.error} onBack={() => setSelectedId(null)} onChanged={refreshAll} />
          ) : (
            lone.data && <LoneList data={lone.data} signal={signal} onSignalChange={setSignal} onSelect={setSelectedId} onChanged={refreshAll} />
          )}
        </div>
      </div>
    </div>
  );
}
