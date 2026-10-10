import { operationAmountSchema } from './ledgerStore.ts';

const REPLY = /^(\d+(?:[.,]\d+)?)\s*(?:€|евро)?\.?(?:\s+([\s\S]*))?$/i;

export function parseOperationReply(
  text: string,
): { amount: number; note: string } | null {
  const match = REPLY.exec(text.trim());
  if (!match) return null;
  const amount = operationAmountSchema.safeParse(
    Number(match[1].replace(',', '.')),
  );
  if (!amount.success) return null;
  return { amount: amount.data, note: (match[2] ?? '').trim() };
}
