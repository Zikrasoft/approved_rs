import { adminLanguageScript } from '../admin-language';

const browser = (stored: Record<string, string>, cookie = '') => {
  const storage = new Map(Object.entries(stored));
  const page = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
    document: { cookie },
  };
  new Function('localStorage', 'document', adminLanguageScript)(
    page.localStorage,
    page.document,
  );
  return { storage, cookie: page.document.cookie };
};

describe('admin language', () => {
  it('opens a fresh browser in Russian', () => {
    const { storage, cookie } = browser({});
    expect(storage.get('lng')).toBe('ru');
    expect(cookie).toMatch(/^lng=ru;path=\//);
  });

  it('moves a browser that fell back to English to Russian once', () => {
    const { storage, cookie } = browser({ lng: 'en' }, 'lng=en');
    expect(storage.get('lng')).toBe('ru');
    expect(cookie).toMatch(/^lng=ru;/);
  });

  it('keeps a language chosen after the switch', () => {
    const { storage, cookie } = browser(
      { lng: 'en', 'carlab-admin-language': 'ru' },
      'lng=en',
    );
    expect(storage.get('lng')).toBe('en');
    expect(cookie).toBe('lng=en');
  });
});
