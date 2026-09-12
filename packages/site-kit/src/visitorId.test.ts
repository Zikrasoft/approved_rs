import { describe, it, expect, vi } from 'vitest';
import { readOrCreateVisitorId } from './visitorId.ts';

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
