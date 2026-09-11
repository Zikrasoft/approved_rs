import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectVisitorCountry } from './visitorCountry';

function stubTimeZone(timeZone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions,
  } as Intl.DateTimeFormat);
}

describe('detectVisitorCountry', () => {
  afterEach(() => vi.restoreAllMocks());

  it('maps a known IANA zone to its country code', () => {
    stubTimeZone('Europe/Belgrade');
    expect(detectVisitorCountry()).toBe('rs');
  });

  it('maps both aliases of a zone that changed name to the same country', () => {
    stubTimeZone('Europe/Kyiv');
    expect(detectVisitorCountry()).toBe('ua');
    stubTimeZone('Europe/Kiev');
    expect(detectVisitorCountry()).toBe('ua');
  });

  it('returns undefined for a zone outside the curated list', () => {
    stubTimeZone('America/New_York');
    expect(detectVisitorCountry()).toBeUndefined();
  });

  it('returns undefined instead of throwing if Intl access fails', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(detectVisitorCountry()).toBeUndefined();
  });
});
