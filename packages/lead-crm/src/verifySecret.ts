import { timingSafeEqual } from 'node:crypto';

const BEARER = /^bearer /i;

export const bearerToken = (header: string | null | undefined): string =>
  header && BEARER.test(header) ? header.replace(BEARER, '') : '';

export type AcceptedSecrets =
  string | undefined | readonly (string | undefined)[];

function matchesOne(received: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function secretMatches(
  received: string | null | undefined,
  accepted: AcceptedSecrets,
): boolean {
  if (!received) return false;
  return [accepted].flat().some((expected) => matchesOne(received, expected));
}
