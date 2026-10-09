// Shared loading / error / empty states.
export function Loading({ label = 'Loading' }) {
  return <div className="muted" style={{ padding: 24 }}>{label}…</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="panel" style={{ borderColor: 'var(--red)' }}>
      <div style={{ color: 'var(--red)' }}>{error.code || 'ERROR'}: {error.message}</div>
      {onRetry && <button className="btn" style={{ marginTop: 8 }} onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Empty({ label = 'Nothing here yet' }) {
  return <div className="muted" style={{ padding: 24, textAlign: 'center' }}>{label}</div>;
}

// Dashed placeholder for unbuilt components. Remove once the component is real.
export function Todo({ name, children }) {
  return <div className="todo"><strong>TODO: {name}</strong>{children ? `\n${children}` : ''}</div>;
}
