import { describe, it, expect } from 'vitest';
import { createMemoryStorage } from './memory.testing.ts';
import { StorageConflictError } from './types.ts';

describe('createMemoryStorage', () => {
  it('starts empty', async () => {
    await expect(createMemoryStorage().read()).resolves.toEqual({
      raw: undefined,
      version: undefined,
    });
  });

  it('round-trips a write and hands back a version', async () => {
    const storage = createMemoryStorage();

    await storage.write([{ id: 1 }], undefined);
    const snapshot = await storage.read();

    expect(snapshot.raw).toEqual([{ id: 1 }]);
    expect(snapshot.version).toBeDefined();
  });

  it('rejects a write whose version is no longer current', async () => {
    const storage = createMemoryStorage();
    await storage.write([], undefined);

    await expect(storage.write([], 'stale')).rejects.toBeInstanceOf(
      StorageConflictError,
    );
  });

  it('stores a copy, so mutating the written array cannot change what is stored', async () => {
    const storage = createMemoryStorage();
    const leads = [{ id: 1 }];

    await storage.write(leads, undefined);
    leads[0]!.id = 99;

    await expect(storage.read()).resolves.toMatchObject({ raw: [{ id: 1 }] });
  });

  it('counts conflicting writes as attempts too', async () => {
    const storage = createMemoryStorage();
    storage.failNextWrites(1);

    await expect(storage.write([], undefined)).rejects.toBeInstanceOf(
      StorageConflictError,
    );
    await storage.write([], undefined);

    expect(storage.writeAttempts()).toBe(2);
  });

  it('runs the conflict hook before throwing, so a test can simulate a concurrent writer', async () => {
    const storage = createMemoryStorage();
    const seen: string[] = [];
    storage.failNextWrites(1, () => seen.push('hook'));

    await expect(storage.write([], undefined)).rejects.toBeInstanceOf(
      StorageConflictError,
    );

    expect(seen).toEqual(['hook']);
  });

  it('seed() installs a state without going through write()', async () => {
    const storage = createMemoryStorage();

    storage.seed([{ id: 7 }]);

    expect(storage.current()).toEqual([{ id: 7 }]);
    expect(storage.writeAttempts()).toBe(0);
  });
});
