// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  AD_TOUCH_MAX_AGE_MS,
  AD_TOUCH_STORAGE_KEY,
  forgetAdTouch,
  paidTouch,
  rememberAdTouch,
  storedAdTouch,
  storedMetaIds,
} from './adTouch.ts';
import { STORAGE_KEY as CONSENT_KEY } from './consent.ts';

const NOW = new Date('2026-10-12T10:00:00.000Z');
const AT = NOW.toISOString();
const page = (query: string) => `https://carlab.rs/sr/?${query}`;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { storage: () => storage, data };
}

const blocked = () => {
  throw new Error('SecurityError');
};

describe('paidTouch', () => {
  it.each([
    ['fbclid=abc', 'facebook'],
    ['gclid=abc', 'google'],
    ['fbclid=abc&utm_source=Instagram', 'instagram'],
    ['utm_medium=CPC&utm_source=google', 'google'],
    ['utm_medium=paid&utm_source=facebook', 'facebook'],
    ['fbclid=abc&utm_source=%3C%3E', 'facebook'],
  ])('recognises %s as an ad from %s', (query, source) => {
    expect(paidTouch(page(query), NOW)?.source).toBe(source);
  });

  it.each(['paid_social', 'ppc', 'CPC'])(
    'keeps a visit only utm_medium=%s identifies, with no source',
    (medium) => {
      expect(paidTouch(page(`utm_medium=${medium}`), NOW)).toEqual({
        medium: medium.toLowerCase(),
        at: AT,
      });
    },
  );

  it('strips what an ad label may not carry instead of dropping the visit', () => {
    expect(
      paidTouch(
        page(
          'gclid=1&utm_source=Google%3Cx%3E&utm_campaign=Spring%F0%9F%9A%97',
        ),
        NOW,
      ),
    ).toMatchObject({ source: 'googlex', campaign: 'Spring' });
  });

  it.each(['', 'utm_source=facebook', 'utm_medium=organic', 'utm_medium='])(
    'leaves %p alone',
    (query) => {
      expect(paidTouch(page(query), NOW)).toBeNull();
    },
  );

  it('keeps the campaign and content, capped, and the moment of the visit', () => {
    expect(
      paidTouch(
        page(`fbclid=x&utm_campaign=${'c'.repeat(150)}&utm_content=%20reel%20`),
        NOW,
      ),
    ).toEqual({
      source: 'facebook',
      campaign: 'c'.repeat(100),
      content: 'reel',
      at: AT,
      fbc: `fb.1.${NOW.getTime()}.x`,
    });
  });

  it('builds fbc from the fbclid exactly as it came, case kept', () => {
    expect(paidTouch(page('fbclid=IwAR2F4-dbP0_l7Mn'), NOW)?.fbc).toBe(
      `fb.1.${NOW.getTime()}.IwAR2F4-dbP0_l7Mn`,
    );
    expect(paidTouch(page('gclid=1'), NOW)?.fbc).toBeUndefined();
  });
});

describe('rememberAdTouch / storedAdTouch', () => {
  it('remembers an ad landing and hands it back', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('gclid=1&utm_campaign=brakes'), storage, NOW);
    expect(JSON.parse(storedAdTouch(storage, NOW))).toEqual({
      source: 'google',
      campaign: 'brakes',
      at: AT,
    });
  });

  it('keeps the first touch while it is fresh', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('fbclid=1'), storage, NOW);
    rememberAdTouch(page('gclid=1'), storage, NOW);
    expect(JSON.parse(storedAdTouch(storage, NOW)).source).toBe('facebook');
  });

  it('forgets a touch after 30 days, and a new ad landing replaces it', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('fbclid=1'), storage, NOW);
    const later = new Date(NOW.getTime() + AD_TOUCH_MAX_AGE_MS);
    expect(storedAdTouch(storage, later)).toBe('');
    rememberAdTouch(page('gclid=1'), storage, later);
    expect(JSON.parse(storedAdTouch(storage, later)).source).toBe('google');
  });

  it('ignores a landing that is not an ad', () => {
    const { storage, data } = memoryStorage();
    rememberAdTouch(page('utm_source=newsletter'), storage, NOW);
    expect(data.has(AD_TOUCH_STORAGE_KEY)).toBe(false);
  });

  it.each(['not json', 'null', '{}'])(
    'reads nothing from an unreadable stored value %p',
    (raw) => {
      const { storage } = memoryStorage({ [AD_TOUCH_STORAGE_KEY]: raw });
      expect(storedAdTouch(storage, NOW)).toBe('');
    },
  );

  it('neither stores nor hands back a touch once analytics was declined', () => {
    const declined = JSON.stringify({ analytics: false });
    const { storage, data } = memoryStorage({ [CONSENT_KEY]: declined });
    rememberAdTouch(page('fbclid=1'), storage, NOW);
    expect(data.has(AD_TOUCH_STORAGE_KEY)).toBe(false);
    data.set(AD_TOUCH_STORAGE_KEY, JSON.stringify({ source: 'x', at: AT }));
    expect(storedAdTouch(storage, NOW)).toBe('');
  });

  it('survives blocked storage', () => {
    expect(() => rememberAdTouch(page('fbclid=1'), blocked, NOW)).not.toThrow();
    expect(storedAdTouch(blocked, NOW)).toBe('');
  });

  it('survives storage that refuses the write', () => {
    const storage = () => ({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => rememberAdTouch(page('fbclid=1'), storage, NOW)).not.toThrow();
  });

  it('reads the page and localStorage by default', () => {
    localStorage.clear();
    history.replaceState(null, '', '/sr/?fbclid=1');
    rememberAdTouch();
    expect(JSON.parse(storedAdTouch()).source).toBe('facebook');
  });
});

describe('storedMetaIds', () => {
  const FBC = 'fb.1.1760000000000.IwAR2F4';
  const cookies = `_ga=1; _fbp=fb.1.1596403881668.1116446470; _fbc=${FBC}`;

  it('reads _fbc and _fbp from the cookies', () => {
    const { storage } = memoryStorage();
    expect(JSON.parse(storedMetaIds(cookies, storage, NOW))).toEqual({
      fbc: FBC,
      fbp: 'fb.1.1596403881668.1116446470',
    });
  });

  it('falls back to the fbc built from the first ad landing', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('fbclid=IwAR9'), storage, NOW);
    expect(
      JSON.parse(
        storedMetaIds('_fbp=fb.1.1596403881668.1116446470', storage, NOW),
      ),
    ).toEqual({
      fbc: `fb.1.${NOW.getTime()}.IwAR9`,
      fbp: 'fb.1.1596403881668.1116446470',
    });
  });

  it('prefers the cookie over the stored landing', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('fbclid=IwAR9'), storage, NOW);
    expect(JSON.parse(storedMetaIds(`_fbc=${FBC}`, storage, NOW))).toEqual({
      fbc: FBC,
    });
  });

  it('sends nothing without any Meta id', () => {
    const { storage } = memoryStorage();
    rememberAdTouch(page('gclid=1'), storage, NOW);
    expect(storedMetaIds('_ga=1; _fbp=', storage, NOW)).toBe('');
  });

  it('sends nothing once analytics was declined, or with blocked storage', () => {
    const declined = JSON.stringify({ analytics: false });
    const { storage } = memoryStorage({ [CONSENT_KEY]: declined });
    expect(storedMetaIds(cookies, storage, NOW)).toBe('');
    expect(storedMetaIds(cookies, blocked, NOW)).toBe('');
  });

  it('reads document.cookie and localStorage by default', () => {
    localStorage.clear();
    document.cookie = '_fbp=fb.1.1596403881668.1116446470';
    expect(JSON.parse(storedMetaIds())).toEqual({
      fbp: 'fb.1.1596403881668.1116446470',
    });
  });
});

describe('forgetAdTouch', () => {
  it('removes the stored touch', () => {
    localStorage.setItem(AD_TOUCH_STORAGE_KEY, '{}');
    forgetAdTouch(localStorage);
    expect(localStorage.getItem(AD_TOUCH_STORAGE_KEY)).toBeNull();
  });

  it('survives blocked storage', () => {
    expect(() => forgetAdTouch({ removeItem: () => blocked() })).not.toThrow();
  });
});
