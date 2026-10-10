import { z } from 'zod';
import { incomeCommission, roundMoney } from './money.ts';
import type { StoredLead } from './schema.ts';

export const LEDGER_AUTHORS = ['owner', 'admin'] as const;
const ledgerAuthorSchema = z.enum(LEDGER_AUTHORS);
export type LedgerAuthor = z.infer<typeof ledgerAuthorSchema>;

const payoutEditSchema = z.object({
  before: z.number().nonnegative(),
  after: z.number().nonnegative(),
  at: z.string(),
  by: ledgerAuthorSchema,
});
export type PayoutEdit = z.infer<typeof payoutEditSchema>;

const recordPromptSchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
});
export type RecordPrompt = z.infer<typeof recordPromptSchema>;

export const payoutSchema = z.object({
  type: z.literal('payout'),
  id: z.number().int().positive(),
  amount: z.number().nonnegative(),
  note: z.string().default(''),
  createdAt: z.string(),
  createdBy: ledgerAuthorSchema,
  leadId: z.number().int().positive().nullable().default(null),
  brand: z.string().nullable().default(null),
  edits: z.array(payoutEditSchema).default(() => []),
  pendingPrompt: recordPromptSchema.nullable().catch(null),
  migratedFrom: z.string().optional(),
});
export type Payout = z.infer<typeof payoutSchema>;

export const settlementSchema = z.object({
  type: z.literal('settlement'),
  id: z.number().int().positive(),
  amount: z.number().positive(),
  createdAt: z.string(),
  createdBy: ledgerAuthorSchema,
  migratedFrom: z.string().optional(),
});
export type Settlement = z.infer<typeof settlementSchema>;

const draftPromptSchema = recordPromptSchema.extend({
  draftMessageId: z.number().int(),
});
export type DraftPrompt = z.infer<typeof draftPromptSchema>;

export const draftSchema = z.object({
  type: z.literal('draft'),
  id: z.number().int().positive(),
  amount: z.number().positive(),
  note: z.string().default(''),
  brand: z.string().nullable().default(null),
  leadId: z.number().int().positive().nullable().default(null),
  matchPending: z.boolean().default(false),
  createdAt: z.string(),
  createdBy: ledgerAuthorSchema,
  pendingPrompt: draftPromptSchema.nullable().catch(null),
});
export type Draft = z.infer<typeof draftSchema>;

export const ledgerRecordSchema = z.discriminatedUnion('type', [
  payoutSchema,
  settlementSchema,
  draftSchema,
]);

export interface Ledger {
  payouts: Payout[];
  settlements: Settlement[];
}

export function nextLedgerId(records: { id: number }[]): number {
  return records.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

export function newSettlement(
  { settlements }: Ledger,
  amount: number,
): Settlement {
  return settlementSchema.parse({
    type: 'settlement',
    id: nextLedgerId(settlements),
    amount,
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
  });
}

export function ledgerBalance({ payouts, settlements }: Ledger): number {
  const sum = (records: { amount: number }[]) =>
    records.reduce((total, r) => total + r.amount, 0);
  return roundMoney(sum(payouts) - sum(settlements));
}

export function isSettled(payout: Payout, settlements: Settlement[]): boolean {
  return settlements.some((s) => s.createdAt > payout.createdAt);
}

export type PayoutCorrection =
  { ok: true; payout: Payout } | { ok: false; reason: 'not_found' | 'settled' };

export function correction(
  { payouts, settlements }: Ledger,
  id: number,
  amount: number,
  by: LedgerAuthor,
): PayoutCorrection {
  const payout = payouts.find((p) => p.id === id);
  if (!payout) return { ok: false, reason: 'not_found' };
  if (by !== 'admin' && isSettled(payout, settlements)) {
    return { ok: false, reason: 'settled' };
  }
  const edit = {
    before: payout.amount,
    after: amount,
    at: new Date().toISOString(),
    by,
  };
  return {
    ok: true,
    payout: {
      ...payout,
      amount,
      edits: [...payout.edits, edit],
      pendingPrompt: null,
    },
  };
}

export function withMigratedIncomes(
  leads: StoredLead[],
  ledger: Ledger,
): Ledger {
  const payouts = [...ledger.payouts];
  const settlements = [...ledger.settlements];
  const paidOut = new Set(payouts.map((p) => p.migratedFrom));
  const settled = new Set(settlements.map((s) => s.migratedFrom));
  for (const lead of leads) {
    for (const income of lead.incomes) {
      const key = `income:${lead.id}:${income.id}`;
      const amount = incomeCommission(income.amount, lead.commissionPercent);
      if (amount <= 0) continue;
      if (!paidOut.has(key)) {
        payouts.push({
          type: 'payout',
          id: nextLedgerId(payouts),
          amount,
          note: '',
          createdAt: income.at,
          createdBy: 'owner',
          leadId: lead.id,
          brand: lead.brand,
          edits: [],
          pendingPrompt: null,
          migratedFrom: key,
        });
      }
      if (income.paidAt && !settled.has(key)) {
        settlements.push({
          type: 'settlement',
          id: nextLedgerId(settlements),
          amount,
          createdAt: income.paidAt,
          createdBy: 'admin',
          migratedFrom: key,
        });
      }
    }
  }
  return { payouts, settlements };
}
