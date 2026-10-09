import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const FIELD_TYPES = [
  { key: 'bankAccount', label: 'Account', color: '#5B9BD5' },
  { key: 'phoneMasked', label: 'Phone', color: '#55C2A3' },
  { key: 'registrationIp', label: 'Reg. IP', color: '#B69CFF' },
  { key: 'upiId', label: 'UPI ID', color: '#F2B66D' },
  { key: 'address', label: 'Address', color: '#E58CA8' },
];

const BACKGROUND = '#202B3B';
const EDGE_COLOR = '#6385AC';

function displayValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return value.label ?? value.value ?? value.name ?? '';
  }
  return String(value).trim();
}

function buildGraph(records) {
  const nodes = [];
  const links = [];
  const groups = new Map();
  const recordIds = new Set();

  for (const record of records) {
    if (!record?.recordId) continue;
    const id = String(record.recordId);
    if (recordIds.has(id)) continue;
    recordIds.add(id);

    nodes.push({
      id,
      label: id,
      nodeType: 'record',
      color:
        record.riskLevel === 'high'
          ? '#F06D75'
          : record.riskLevel === 'medium'
            ? '#E8B45E'
            : '#58B89A',
      riskLevel: record.riskLevel ?? 'unknown',
      riskScore: record.riskScore,
      fields: record.fields ?? {},
      anomalies: record.anomalies ?? [],
    });

    for (const field of FIELD_TYPES) {
      const value = displayValue(record.fields?.[field.key]);
      if (!value || value === '-' || value.toLowerCase() === 'unknown') continue;

      const groupKey = `${field.key}:${value}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          field,
          value,
          recordIds: new Set(),
        });
      }
      groups.get(groupKey).recordIds.add(id);
    }
  }

  for (const [groupKey, group] of groups) {
    const connectedRecords = [...group.recordIds];

    // Only show relationships supported by a value shared by at least
    // two distinct records. A shared value is a lead, not proof of fraud.
    if (connectedRecords.length < 2) continue;

    const attributeId = `shared:${groupKey}`;
    nodes.push({
      id: attributeId,
      label: group.value,
      nodeType: 'attribute',
      attributeType: group.field.label,
      color: group.field.color,
      recordCount: connectedRecords.length,
    });

    for (const recordId of connectedRecords) {
      links.push({
        source: recordId,
        target: attributeId,
        color: EDGE_COLOR,
        relationship: `Shared ${group.field.label.toLowerCase()}`,
      });
    }
  }

  return { nodes, links };
}

export default function LoneNetworkGraph({
  data,
  selectedId,
  onSelect,
}) {
  const graphRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const records = Array.isArray(data)
    ? data
    : data?.items ?? [];

  const graphData = useMemo(() => buildGraph(records), [records]);

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length) {
      graphRef.current.zoomToFit(500, 45);
    }
  }, [graphData]);

  const handleNodeClick = (node) => {
    if (node.nodeType === 'record') {
      onSelect?.(node.id);
    } else {
      setHoveredNode(node);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 560,
        overflow: 'hidden',
        borderRadius: 10,
        background: BACKGROUND,
        color: '#E6EDF5',
      }}
    >
      <div
        style={{
          position: 'absolute',
          zIndex: 2,
          top: 16,
          left: 18,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          Lone threat network
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: '#AAB8C9' }}>
          {graphData.nodes.filter((n) => n.nodeType === 'record').length} records
          {' · '}
          {graphData.links.length} shared-field links
        </div>
      </div>

      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        backgroundColor={BACKGROUND}
        width={undefined}
        height={undefined}
        nodeId="id"
        nodeLabel={(node) =>
          node.nodeType === 'record'
            ? `${node.id}\nRisk: ${node.riskLevel}\nScore: ${node.riskScore ?? 'N/A'}`
            : `${node.attributeType}: ${node.label}\nShared by ${node.recordCount} records`
        }
        nodeRelSize={4}
        nodeVal={(node) => (node.nodeType === 'record' ? 3 : 2)}
        linkColor={() => EDGE_COLOR}
        linkWidth={0.8}
        linkOpacity={0.65}
        cooldownTicks={100}
        enableNodeDrag
        enableZoomInteraction
        enablePanInteraction
        onNodeClick={handleNodeClick}
        onNodeHover={setHoveredNode}
        onBackgroundClick={() => {
          setHoveredNode(null);
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const isRecord = node.nodeType === 'record';
          const isSelected = isRecord && String(selectedId) === String(node.id);
          const radius = isSelected ? 6 : isRecord ? 4 : 3.5;

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = node.color;
          ctx.fill();

          if (isSelected || hoveredNode?.id === node.id) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 3, 0, 2 * Math.PI);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
          }

          const showLabel =
            globalScale > 1.1 ||
            isSelected ||
            hoveredNode?.id === node.id;

          if (showLabel) {
            const fontSize = Math.max(3, 10 / globalScale);
            ctx.font = `${isSelected ? '600 ' : ''}${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = isRecord ? '#E6EDF5' : '#B8C9DC';

            const label = isRecord
              ? node.id
              : `${node.attributeType}: ${node.label}`;

            ctx.fillText(
              label.length > 28 ? `${label.slice(0, 25)}...` : label,
              node.x,
              node.y + radius + 3,
            );
          }
        }}
      />

      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            zIndex: 3,
            right: 14,
            bottom: 14,
            maxWidth: 260,
            padding: '10px 12px',
            border: '1px solid #40516A',
            borderRadius: 8,
            background: '#182231',
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 5 }}>
            {hoveredNode.nodeType === 'record'
              ? hoveredNode.id
              : `${hoveredNode.attributeType}: ${hoveredNode.label}`}
          </div>
          {hoveredNode.nodeType === 'record' ? (
            <>
              <div>Risk level: {hoveredNode.riskLevel}</div>
              <div>Risk score: {hoveredNode.riskScore ?? 'N/A'}</div>
              <div style={{ marginTop: 5, color: '#AAB8C9' }}>
                Click to open record details.
              </div>
            </>
          ) : (
            <div>Shared by {hoveredNode.recordCount} records.</div>
          )}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          fontSize: 10,
          color: '#C4D0DF',
          pointerEvents: 'none',
        }}
      >
        {[
          ['#F06D75', 'High risk'],
          ['#E8B45E', 'Medium risk'],
          ['#58B89A', 'Low risk'],
          ['#5B9BD5', 'Shared account'],
          ['#55C2A3', 'Shared phone'],
          ['#B69CFF', 'Shared device'],
        ].map(([color, label]) => (
          <span
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: color,
                display: 'inline-block',
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}