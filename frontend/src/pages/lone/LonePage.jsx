// OWNER: Lone. Same layout as the Ring page: big constellation (left) + cards / detail (right).
import { useMemo, useState } from 'react';
import { getLonePoints, getLone, getRecord } from '../../api/client.js';
import { useApi } from '../../hooks/useApi.js';
import { ErrorBox, Loading } from '../../components/States.jsx';
import LoneConstellation from './components/LoneConstellation.jsx';
import { SignalCards, GhostCards } from './components/LoneCards.jsx';
import LoneDetailPanel from './components/LoneDetailPanel.jsx';
import RecordSearch from './components/RecordSearch.jsx';
import { SIGNAL_BY_ID, topSignalOf } from './signals.js';
import '../rings/rings.css';

// The list endpoint pages at 100; the constellation needs every flagged record.
async function getAllLone() {
  const first = await getLone({ pageSize: 100, page: 1 });
  const pages = Math.ceil(first.total / 100);
  const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => getLone({ pageSize: 100, page: i + 2 })));
  return { ...first, items: [...first.items, ...rest.flatMap((r) => r.items)] };
}

export default function LonePage() {
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const lone = useApi(() => getAllLone(), []);
  const points = useApi(() => getLonePoints({ includeNormal: true, normalSample: 400 }), []);
  const detail = useApi(() => (selectedId ? getRecord(selectedId) : Promise.resolve(null)), [selectedId]);

  // Stable references: the graph only rebuilds (and re-lays out) when the data really changes.
  const items = useMemo(() => (lone.data ? lone.data.items : []), [lone.data]);
  const stars = useMemo(() => (points.data ? points.data.points.filter((p) => !p.flagged) : []), [points.data]);
  const selectedItem = selectedId && items.find((i) => i.recordId === selectedId);
  const colorSignal = selectedItem ? topSignalOf(selectedItem) : selectedSignal;

  const refreshAll = () => {
    lone.reload();
    points.reload();
    detail.reload();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Lone threats</h1>
        <RecordSearch onSelect={setSelectedId} />
      </div>

      <ErrorBox error={lone.error || points.error} onRetry={refreshAll} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(360px, 1fr)', gap: 16, minHeight: 600 }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden', background: '#040D1F', position: 'relative' }}>
          {lone.loading && !lone.data ? <Loading label="Drawing constellation" /> : (
            <LoneConstellation
              items={items}
              stars={stars}
              selectedSignal={selectedSignal}
              selectedRecordId={selectedId}
              onSelectSignal={setSelectedSignal}
              onSelectRecord={setSelectedId}
            />
          )}
        </div>
        <div className="panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {selectedId ? (
            <LoneDetailPanel
              record={detail.data}
              loading={detail.loading}
              error={detail.error}
              color={colorSignal && SIGNAL_BY_ID[colorSignal] ? SIGNAL_BY_ID[colorSignal].color : null}
              backLabel={selectedSignal ? `← ${SIGNAL_BY_ID[selectedSignal].label}` : '← All signals'}
              onBack={() => setSelectedId(null)}
              onChanged={refreshAll}
            />
          ) : selectedSignal ? (
            <GhostCards signal={selectedSignal} items={items} onBack={() => setSelectedSignal(null)} onSelect={setSelectedId} onChanged={refreshAll} />
          ) : (
            lone.data && <SignalCards items={items} onSelect={setSelectedSignal} />
          )}
        </div>
      </div>
    </div>
  );
}
