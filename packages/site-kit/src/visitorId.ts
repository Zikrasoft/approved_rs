import { STORAGE_KEY as CONSENT_KEY, analyticsDeclined } from './consent.ts';

export const VISITOR_ID_STORAGE_KEY = 'visitor_id';

export interface VisitorIdEnvironment {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  randomId: () => string;
}

// The id only exists to tie a visitor's contact clicks to the lead they
// later submit, which is the tracking the banner asks about — a visitor who
// said no gets no id, and the lead is stored without one.
export function readOrCreateVisitorId({
  storage,
  randomId,
}: VisitorIdEnvironment): string {
  try {
    if (analyticsDeclined(storage.getItem(CONSENT_KEY))) return '';
    const existing = storage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = randomId();
    storage.setItem(VISITOR_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}

// A refusal has to clear what was already minted, otherwise a visitor who
// later accepts is silently re-identified under their pre-refusal id.
export function forgetVisitorId(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(VISITOR_ID_STORAGE_KEY);
  } catch {
    // Blocked storage never held an id to begin with.
  }
}
