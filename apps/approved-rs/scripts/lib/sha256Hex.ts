import { createHash } from 'node:crypto';

// Short fingerprint of a ru source, stored alongside its translations so a
// later run can tell "ru hasn't changed, these are still good" from "ru
// changed, redo all four" without re-translating on every push. Shared by
// translate-cases.ts (`${title}\n${body}`) and translate-i18n.ts
// (`JSON.stringify(data)`) — each owns its own serialization, only the
// hash-and-truncate step is common.
export function sha256Hex(input: string, length = 16): string {
  return createHash('sha256').update(input).digest('hex').slice(0, length);
}
