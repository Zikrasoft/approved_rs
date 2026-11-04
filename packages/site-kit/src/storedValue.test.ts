// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import {
  forgetStored,
  readStored,
  readStoredJson,
  writeStored,
  writeStoredJson,
} from './storedValue.ts';

const blocked = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

const schema = z.object({ count: z.number() });

beforeEach(() => localStorage.clear());

describe('readStored / writeStored', () => {
  it('round-trips through localStorage by default', () => {
    expect(writeStored('k', 'v')).toBe(true);
    expect(readStored('k')).toBe('v');
  });

  it('uses the storage it is handed', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    writeStored('k', 'v', storage);
    expect(readStored('k', storage)).toBe('v');
    expect(readStored('k')).toBeNull();
  });

  it('forgets a key', () => {
    writeStored('k', 'v');
    expect(forgetStored('k')).toBe(true);
    expect(readStored('k')).toBeNull();
  });

  it('survives blocked storage', () => {
    expect(writeStored('k', 'v', blocked)).toBe(false);
    expect(readStored('k', blocked)).toBeNull();
    expect(forgetStored('k', blocked)).toBe(false);
  });
});

describe('readStoredJson / writeStoredJson', () => {
  it('round-trips a value the schema accepts', () => {
    expect(writeStoredJson('k', { count: 2 })).toBe(true);
    expect(readStoredJson('k', schema, null)).toEqual({ count: 2 });
  });

  it('falls back when nothing is stored', () => {
    expect(readStoredJson('k', schema, null)).toBeNull();
  });

  it('falls back on a value the schema refuses', () => {
    writeStored('k', '{"count":"2"}');
    expect(readStoredJson('k', schema, null)).toBeNull();
  });

  it('falls back on text that is not JSON', () => {
    writeStored('k', '{');
    expect(readStoredJson('k', schema, null)).toBeNull();
  });

  it('survives blocked storage', () => {
    expect(writeStoredJson('k', { count: 1 }, blocked)).toBe(false);
    expect(readStoredJson('k', schema, null, blocked)).toBeNull();
  });
});
