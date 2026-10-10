import { z } from 'zod';

export const MAX_OPERATION_AMOUNT = 1_000_000;

const REPLY = /^(\d+)(?:[.,](\d+))?\s*(?:€|евро)?\.?(?:\s+([\s\S]*))?$/i;

const amountSchema = z.number().positive().max(MAX_OPERATION_AMOUNT);

export type OperationRefusal = 'no_number' | 'bad_amount';

export type OperationReply =
  | { ok: true; amount: number; note: string }
  | { ok: false; reason: OperationRefusal };

export function parseOperationReply(text: string): OperationReply {
  const match = REPLY.exec(text.trim());
  if (!match) return { ok: false, reason: 'no_number' };
  const [, whole, cents = '', note = ''] = match;
  const amount = amountSchema.safeParse(Number(`${whole}.${cents || '0'}`));
  if (cents.length > 2 || !amount.success)
    return { ok: false, reason: 'bad_amount' };
  return { ok: true, amount: amount.data, note: note.trim() };
}
