import { createHash } from 'node:crypto';

export function sha256Hex(input: string, length = 16): string {
  return createHash('sha256').update(input).digest('hex').slice(0, length);
}
