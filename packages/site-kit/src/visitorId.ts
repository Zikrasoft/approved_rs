const STORAGE_KEY = 'visitor_id';

export interface VisitorIdEnvironment {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  randomId: () => string;
}

export function readOrCreateVisitorId({
  storage,
  randomId,
}: VisitorIdEnvironment): string {
  try {
    const existing = storage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const id = randomId();
    storage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}
