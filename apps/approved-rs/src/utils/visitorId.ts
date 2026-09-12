const STORAGE_KEY = 'visitor_id';

// One random ID per browser, generated on first use and reused from
// localStorage after that — lets staff spot the same visitor across
// multiple lead submissions/contact clicks without any real tracking
// (no cross-device/cross-browser identity, just this one origin's storage).
export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}
