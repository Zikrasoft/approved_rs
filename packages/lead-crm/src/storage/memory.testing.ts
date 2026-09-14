import {
  StorageConflictError,
  type LeadStorage,
  type StorageSnapshot,
} from './types.ts';

export interface MemoryStorage extends LeadStorage {
  seed(raw: unknown): void;
  current(): unknown;
  failNextWrites(count: number, onConflict?: () => void): void;
  writeAttempts(): number;
}

export function createMemoryStorage(): MemoryStorage {
  let raw: unknown;
  let version: string | undefined;
  let versionCounter = 0;
  let attempts = 0;
  let pendingFailures = 0;
  let onConflict: (() => void) | undefined;

  return {
    read(): Promise<StorageSnapshot> {
      return Promise.resolve({ raw, version });
    },

    write(leads: unknown, expectedVersion: string | undefined): Promise<void> {
      attempts += 1;
      if (pendingFailures > 0) {
        pendingFailures -= 1;
        const hook = onConflict;
        if (pendingFailures === 0) onConflict = undefined;
        hook?.();
        return Promise.reject(new StorageConflictError());
      }
      if (expectedVersion !== undefined && expectedVersion !== version) {
        return Promise.reject(new StorageConflictError());
      }
      raw = JSON.parse(JSON.stringify(leads));
      versionCounter += 1;
      version = `v${versionCounter}`;
      return Promise.resolve();
    },

    seed(next: unknown): void {
      raw = next;
      versionCounter += 1;
      version = `v${versionCounter}`;
    },

    current: () => raw,

    failNextWrites(count: number, hook?: () => void): void {
      pendingFailures = count;
      onConflict = hook;
    },

    writeAttempts: () => attempts,
  };
}
