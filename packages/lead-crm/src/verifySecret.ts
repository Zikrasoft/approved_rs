import { timingSafeEqual } from 'node:crypto';

const BEARER = 'Bearer ';

export const bearerToken = (header: string | null | undefined): string =>
  header?.startsWith(BEARER) ? header.slice(BEARER.length) : '';

export function secretMatches(
  received: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
