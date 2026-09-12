export const STORAGE_KEY = 'cookie_consent';

export interface Consent {
  version: string;
  at: string;
  analytics: boolean;
}

export function parseConsent(
  raw: string | null,
  currentVersion: string,
): Consent | null {
  if (!raw) return null;

  // Consent used to be stored as the bare string 'granted'/'denied'. Those
  // predate policy versioning, so they read as "no answer yet" and the
  // visitor is asked once more against the current policy.
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== 'object') return null;
  const consent = value as Partial<Consent>;

  if (
    consent.version !== currentVersion ||
    typeof consent.analytics !== 'boolean' ||
    typeof consent.at !== 'string' ||
    !consent.at
  ) {
    return null;
  }

  return consent as Consent;
}

export function newConsent(
  analytics: boolean,
  version: string,
  now: Date,
): Consent {
  return { version, at: now.toISOString(), analytics };
}

export const analyticsAllowed = (consent: Consent | null): boolean =>
  Boolean(consent?.analytics);
