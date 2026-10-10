import { StorageConflictError } from './types.ts';

const MAX_RETRIES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const base = 25 * 2 ** attempt;
  return base + Math.random() * base;
}

export async function retryOnConflict<T>(
  attempt: () => Promise<T>,
  exhausted: string,
): Promise<T> {
  let lastErr = new StorageConflictError(exhausted);
  for (let tries = 0; tries < MAX_RETRIES; tries++) {
    if (tries > 0) await sleep(backoffDelay(tries - 1));
    try {
      return await attempt();
    } catch (err) {
      if (!(err instanceof StorageConflictError)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}
