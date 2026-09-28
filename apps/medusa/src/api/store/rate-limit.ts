import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

export const WINDOW_MS = 60_000;
export const SWEEP_ABOVE = 1_000;
export const SWEEP_EVERY_MS = 1_000;
export const MAX_KEYS = 50_000;

const seen = new Map<string, number[]>();
let sweptAt = 0;

export type Bucket = [key: string, max: number];

export const clientKey = (req: MedusaRequest, scope: string): string =>
  `${scope}:ip:${req.ip ?? '?'}`;

export const trackedKeys = (): number => seen.size;

export function limit(
  bucketsFor: (req: MedusaRequest) => Bucket[],
  message: string,
) {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ): void => {
    const now = Date.now();
    sweep(now);

    const windows = bucketsFor(req).map(([key, max]) => ({
      key,
      max,
      recent: (seen.get(key) ?? []).filter((at) => now - at < WINDOW_MS),
    }));

    if (windows.some(({ recent, max }) => recent.length >= max)) {
      res.status(429).json({ message });
      return;
    }

    for (const { key, recent } of windows) {
      recent.push(now);
      seen.delete(key);
      seen.set(key, recent);
    }
    evictOldest();
    next();
  };
}

function evictOldest(): void {
  for (const key of seen.keys()) {
    if (seen.size <= MAX_KEYS) {
      return;
    }
    seen.delete(key);
  }
}

function sweep(now: number): void {
  if (seen.size <= SWEEP_ABOVE || now - sweptAt < SWEEP_EVERY_MS) {
    return;
  }
  sweptAt = now;

  for (const [key, times] of seen) {
    if (!times.some((at) => now - at < WINDOW_MS)) {
      seen.delete(key);
    }
  }
}
