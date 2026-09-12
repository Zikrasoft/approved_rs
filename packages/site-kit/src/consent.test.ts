import { describe, it, expect } from 'vitest';
import {
  analyticsAllowed,
  newConsent,
  parseConsent,
  STORAGE_KEY,
} from './consent.ts';

const VERSION = '2026-09-12';

describe('parseConsent', () => {
  it('reads back what newConsent wrote', () => {
    const written = newConsent(true, VERSION, new Date('2026-09-12T10:00:00Z'));
    expect(parseConsent(JSON.stringify(written), VERSION)).toEqual(written);
  });

  it('treats a missing answer as no answer', () => {
    expect(parseConsent(null, VERSION)).toBeNull();
  });

  it('treats the pre-versioning bare string as no answer, so the visitor is asked again', () => {
    expect(parseConsent('granted', VERSION)).toBeNull();
  });

  it('rejects a stored answer given against an older policy', () => {
    const old = newConsent(true, '2020-01-01', new Date());
    expect(parseConsent(JSON.stringify(old), VERSION)).toBeNull();
  });

  it('rejects malformed json', () => {
    expect(parseConsent('{not json', VERSION)).toBeNull();
  });

  it('rejects a json value that is not an object', () => {
    expect(parseConsent('42', VERSION)).toBeNull();
    expect(parseConsent('null', VERSION)).toBeNull();
  });

  it('rejects an object missing the analytics flag or the timestamp', () => {
    expect(
      parseConsent(JSON.stringify({ version: VERSION }), VERSION),
    ).toBeNull();
    expect(
      parseConsent(
        JSON.stringify({ version: VERSION, analytics: true, at: '' }),
        VERSION,
      ),
    ).toBeNull();
    expect(
      parseConsent(
        JSON.stringify({ version: VERSION, analytics: 'yes', at: 'x' }),
        VERSION,
      ),
    ).toBeNull();
  });
});

describe('newConsent', () => {
  it('stamps the policy version and the moment it was given', () => {
    const at = new Date('2026-09-12T10:00:00Z');
    expect(newConsent(false, VERSION, at)).toEqual({
      version: VERSION,
      at: at.toISOString(),
      analytics: false,
    });
  });
});

describe('analyticsAllowed', () => {
  it('is false without an answer and follows the answer otherwise', () => {
    expect(analyticsAllowed(null)).toBe(false);
    expect(analyticsAllowed(newConsent(false, VERSION, new Date()))).toBe(
      false,
    );
    expect(analyticsAllowed(newConsent(true, VERSION, new Date()))).toBe(true);
  });
});

describe('STORAGE_KEY', () => {
  it('keeps the key the existing banner already wrote under', () => {
    expect(STORAGE_KEY).toBe('cookie_consent');
  });
});
