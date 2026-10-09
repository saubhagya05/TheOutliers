// Human decisions (flag / confirm / deflag). In memory only: restarting the server clears them.

const store = { ring: new Map(), record: new Map() };

export function getOverride(kind, id) {
  return store[kind].get(id) || null;
}

// snapshot: the record detail at the time of a manual flag, so it can appear in the lone list.
export function setOverride(kind, id, status, note, snapshot) {
  const entry = { status, note: note ?? null, updatedAt: new Date().toISOString(), snapshot: snapshot || null };
  store[kind].set(id, entry);
  return entry;
}

export function clearOverride(kind, id) {
  store[kind].delete(id);
}

export function recordOverrides() {
  return [...store.record.entries()];
}

export function reviewedCounts() {
  const all = [...store.ring.values(), ...store.record.values()];
  return {
    confirmed: all.filter((o) => o.status === 'confirmed').length,
    deflagged: all.filter((o) => o.status === 'deflagged').length,
  };
}

// A new dataset means new records: earlier decisions no longer apply.
export function clearAllOverrides() {
  store.ring.clear();
  store.record.clear();
}
