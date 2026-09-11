import type { StoredLead } from './schema.ts';

export const PAID_EPSILON = 0.005;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface CommissionInfo {
  commission: number;
  remaining: number;
  isPaidOff: boolean;
}

export function getCommission(
  lead: Pick<StoredLead, 'dealAmount' | 'commissionPercent' | 'paidAmount'>,
): CommissionInfo {
  const commission = roundMoney(
    ((lead.dealAmount ?? 0) * lead.commissionPercent) / 100,
  );
  const remaining = roundMoney(commission - lead.paidAmount);
  return { commission, remaining, isPaidOff: remaining <= PAID_EPSILON };
}
