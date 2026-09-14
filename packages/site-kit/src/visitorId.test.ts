import { describe, it, expect, vi } from 'vitest';
import { forgetVisitorId, readOrCreateVisitorId } from './visitorId.ts';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe('readOrCreateVisitorId', () => {
  it('returns the id already stored for this browser', () => {
    const storage = memoryStorage({ visitor_id: 'existing' });
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      'existing',
    );
  });

  it('generates and persists an id on first use', () => {
    const storage = memoryStorage();
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      'fresh',
    );
    expect(storage.data.get('visitor_id')).toBe('fresh');
  });

  it('returns an empty id instead of throwing when storage is blocked', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(),
    };
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      '',
    );
  });

  it('returns an empty id when writing is blocked after a successful read', () => {
    const storage = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    };
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      '',
    );
  });
});

describe('readOrCreateVisitorId and consent', () => {
  it('mints no id for a visitor who declined', () => {
    const storage = memoryStorage({
      cookie_consent: JSON.stringify({
        version: '1',
        at: 'now',
        analytics: false,
      }),
    });
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      '',
    );
    expect(storage.data.get('visitor_id')).toBeUndefined();
  });

  it('stops handing back an id already stored before the refusal', () => {
    const storage = memoryStorage({
      visitor_id: 'existing',
      cookie_consent: 'denied',
    });
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      '',
    );
  });

  it('mints an id once the visitor accepts', () => {
    const storage = memoryStorage({
      cookie_consent: JSON.stringify({
        version: '1',
        at: 'now',
        analytics: true,
      }),
    });
    expect(readOrCreateVisitorId({ storage, randomId: () => 'fresh' })).toBe(
      'fresh',
    );
  });
});

describe('forgetVisitorId', () => {
  it('drops the id so a later acceptance starts a new one', () => {
    const storage = memoryStorage({ visitor_id: 'existing' });
    forgetVisitorId({
      removeItem: (key: string) => void storage.data.delete(key),
    });
    expect(storage.data.get('visitor_id')).toBeUndefined();
  });

  it('says nothing when storage refuses the delete', () => {
    expect(() =>
      forgetVisitorId({
        removeItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).not.toThrow();
  });
});
