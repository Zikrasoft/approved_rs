import type { Income, StoredLead } from './schema.ts';

export const PAID_EPSILON = 0.005;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function incomeCommission(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}

export function hasIncome(
  lead: StoredLead,
): lead is StoredLead & { dealAmount: number } {
  return lead.dealAmount != null;
}

export function unpaidIncomes(lead: Pick<StoredLead, 'incomes'>): Income[] {
  return lead.incomes.filter((i) => i.paidAt == null);
}

export function appendIncome(incomes: Income[], amount: number): Income[] {
  const id = incomes.reduce((max, i) => Math.max(max, i.id), 0) + 1;
  return [
    ...incomes,
    { id, amount, at: new Date().toISOString(), paidAt: null },
  ];
}

export interface CommissionInfo {
  commission: number;
  remaining: number;
  isPaidOff: boolean;
}

export function getCommission(
  lead: Pick<StoredLead, 'commissionPercent' | 'paidAmount' | 'incomes'>,
): CommissionInfo {
  const commission = roundMoney(
    lead.incomes.reduce(
      (sum, i) => sum + incomeCommission(i.amount, lead.commissionPercent),
      0,
    ),
  );
  const remaining = roundMoney(commission - lead.paidAmount);
  return { commission, remaining, isPaidOff: remaining <= PAID_EPSILON };
}
