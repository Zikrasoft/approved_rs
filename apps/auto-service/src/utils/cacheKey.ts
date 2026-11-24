import { createHash } from 'node:crypto';

const plain = (_key: string, value: unknown) =>
  value instanceof Set
    ? [...value].sort()
    : value instanceof Map
      ? [...value]
      : value;

export const cacheKey = (rendered: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify([new Date().getFullYear(), rendered], plain))
    .digest('hex');
