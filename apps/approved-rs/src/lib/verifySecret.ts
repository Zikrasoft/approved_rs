import { timingSafeEqual } from 'node:crypto';

// Plain `!==` leaks timing info on a security boundary; pad both sides to
// equal length first since timingSafeEqual throws on a length mismatch
// instead of just returning false. Shared by the Telegram webhook and the
// cron-triggered reminders route — both compare an incoming header against
// a server-side secret before doing anything.
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
