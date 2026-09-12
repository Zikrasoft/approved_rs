import { readOrCreateVisitorId } from './visitorId.ts';
import {
  STORAGE_KEY,
  newConsent,
  parseConsent,
  type Consent,
} from './consent.ts';

export function getOrCreateVisitorId(): string {
  return readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });
}

export function readConsent(version: string): Consent | null {
  try {
    return parseConsent(localStorage.getItem(STORAGE_KEY), version);
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean, version: string): Consent {
  const consent = newConsent(analytics, version, new Date());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Private mode or a full quota — the visitor simply gets asked again.
  }
  return consent;
}
