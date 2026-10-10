import { z } from 'zod';
import { roundMoney } from './money.ts';

const PAID_EPSILON = 0.005;

const incomeSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number().positive(),
  at: z.string(),
  paidAt: z.string().nullable().default(null),
});
type Income = z.infer<typeof incomeSchema>;

export interface LegacyIncomes {
  percent: number;
  incomes: Income[];
}

export function legacyPayoutAmount(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}

const legacyMoneySchema = z.object({
  statusChangedAt: z.string(),
  commissionPercent: z.number().nonnegative().max(100).optional(),
  dealAmount: z.number().nonnegative().nullable().default(null),
  paidAmount: z.number().nonnegative().default(0),
  payments: z
    .array(z.object({ amount: z.number().positive(), at: z.string() }))
    .default(() => []),
  incomes: z.array(incomeSchema).default(() => []),
});
type LegacyMoney = z.infer<typeof legacyMoneySchema>;

function incomesOf(money: LegacyMoney, percent: number): Income[] {
  if (money.incomes.length > 0) return money.incomes;
  const total = money.dealAmount;
  if (total == null || total <= 0) return [];
  const at = money.statusChangedAt;
  const paidAt = money.payments.at(-1)?.at ?? at;
  const owed = legacyPayoutAmount(total, percent);
  const whole = (settledAt: string | null): Income[] => [
    { id: 1, amount: total, at, paidAt: settledAt },
  ];
  if (owed <= 0 || money.paidAmount <= PAID_EPSILON) return whole(null);
  if (money.paidAmount >= owed - PAID_EPSILON) return whole(paidAt);
  const covered = roundMoney((total * money.paidAmount) / owed);
  if (covered >= total) return whole(paidAt);
  return [
    { id: 1, amount: covered, at, paidAt },
    { id: 2, amount: roundMoney(total - covered), at, paidAt: null },
  ];
}

export const legacyIncomesSchema: z.ZodType<LegacyIncomes, unknown> =
  legacyMoneySchema.transform((money, ctx) => {
    const percent = money.commissionPercent ?? 0;
    const incomes = incomesOf(money, percent);
    if (incomes.length > 0 && money.commissionPercent === undefined) {
      ctx.addIssue({ code: 'custom', message: 'legacy incomes carry no rate' });
      return z.NEVER;
    }
    return { percent, incomes };
  });
