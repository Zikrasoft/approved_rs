import { STORAGE_KEY as CONSENT_KEY, analyticsDeclined } from './consent.ts';

export const VISITOR_ID_STORAGE_KEY = 'visitor_id';
export const VISITOR_ID_COOKIE = 'visitor_id';
export const VISITOR_ID_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

function mirrorIntoCookie(id: string): void {
  try {
    document.cookie = `${VISITOR_ID_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${id ? VISITOR_ID_COOKIE_MAX_AGE : 0}; samesite=lax; secure`;
  } catch {
    return;
  }
}

function storedOrMintedId(): string {
  try {
    if (analyticsDeclined(localStorage.getItem(CONSENT_KEY))) return '';
    const existing = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}

export function getOrCreateVisitorId(): string {
  const id = storedOrMintedId();
  mirrorIntoCookie(id);
  return id;
}

export function forgetVisitorId(): void {
  mirrorIntoCookie('');
  try {
    localStorage.removeItem(VISITOR_ID_STORAGE_KEY);
  } catch {
    return;
  }
}
