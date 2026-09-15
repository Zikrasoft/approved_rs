export const STORAGE_KEY = 'cookie_consent';
const LEGACY_DENIED = 'denied';

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

// Version-agnostic on purpose: an answer given against an older policy still
// counts as "no" until the visitor answers the current one, so a policy bump
// never silently resumes tracking someone who turned it down.
export function analyticsDeclined(raw: string | null): boolean {
  if (!raw) return false;
  if (raw === LEGACY_DENIED) return true;
  try {
    return (
      (JSON.parse(raw) as { analytics?: unknown } | null)?.analytics === false
    );
  } catch {
    return false;
  }
}

export const CONSENT_EVENT = 'consent:answer';

export interface ConsentDetail {
  analytics: boolean;
}
