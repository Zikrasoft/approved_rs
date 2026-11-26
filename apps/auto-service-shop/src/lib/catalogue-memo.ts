import { causeOf, logEvent } from './log-event';
import { outsideStoreRead } from './store-read';

const MEMO_RETRY_MS = 30_000;

type Entry = {
  value: Promise<unknown>;
  expires: number;
  settled: boolean;
  refreshing: boolean;
};

let entries = new Map<string, Entry>();

export function clearCatalogueMemo(): void {
  entries = new Map();
}

export function forgetCatalogueMemo(...names: string[]): void {
  names.forEach((name) => entries.delete(name));
}

export function markCatalogueMemoStale(...names: string[]): void {
  for (const [name, entry] of entries) {
    if (!names.length || names.includes(name)) entry.expires = 0;
  }
}

function refresh<T>(
  name: string,
  entry: Entry,
  compute: () => Promise<T>,
  ttlMs: number,
): void {
  entry.refreshing = true;
  outsideStoreRead(compute)
    .then(
      (value) => {
        entry.value = Promise.resolve(value);
        entry.expires = Date.now() + ttlMs;
      },
      (error) => {
        entry.expires = Date.now() + MEMO_RETRY_MS;
        logEvent('catalogue.warm', {
          outcome: 'failed',
          memo: name,
          cause: causeOf(error),
        });
      },
    )
    .finally(() => {
      entry.refreshing = false;
    });
}

export function memoized<T>(
  name: string,
  compute: () => Promise<T>,
  ttlMs = Infinity,
): Promise<T> {
  const current = entries;
  const known = current.get(name);
  if (known) {
    if (known.settled && known.expires <= Date.now() && !known.refreshing) {
      refresh(name, known, compute, ttlMs);
    }
    return known.value as Promise<T>;
  }
  const value = outsideStoreRead(compute);
  const entry: Entry = {
    value,
    expires: Date.now() + ttlMs,
    settled: false,
    refreshing: false,
  };
  current.set(name, entry);
  value.then(
    () => {
      entry.settled = true;
    },
    () => current.delete(name),
  );
  return value;
}
