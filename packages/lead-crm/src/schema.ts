import { z } from 'zod';
import { incomeCommission, roundMoney, PAID_EPSILON } from './money.ts';

export const LEAD_STATUSES = [
  'new',
  'negotiations',
  'in_progress',
  'won',
  'lost',
  'postponed',
] as const;
const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

export const PROMPT_KINDS = [
  'deal_amount',
  'add_income',
  'edit_name',
  'edit_contact',
  'edit_comment',
  'postpone',
] as const;

const pendingPromptSchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
  kind: z.enum(PROMPT_KINDS),
});
export type PendingPrompt = z.infer<typeof pendingPromptSchema>;

const paymentSchema = z.object({
  amount: z.number().positive(),
  at: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

const incomeSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number().positive(),
  at: z.string(),
  paidAt: z.string().nullable().default(null),
});
export type Income = z.infer<typeof incomeSchema>;

const pendingCommissionClaimSchema = z.object({
  amount: z.number().positive(),
  claimedAt: z.string(),
  incomeIds: z.array(z.number().int().positive()).default(() => []),
});
export type PendingCommissionClaim = z.infer<
  typeof pendingCommissionClaimSchema
>;

export const LEGACY_BRAND = 'Approved.rs';

export const MAX_COMMISSION_PERCENT = 100;

const baseStoredLeadSchema = z.object({
  id: z.number().int().positive(),
  brand: z.string().default(LEGACY_BRAND),
  name: z.string(),
  contact: z.string(),
  service: z.string(),
  services: z.array(z.string()).default([]),
  contactChannel: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  visitorId: z.string().nullable().optional(),
  locale: z.string(),
  kind: z.enum(['lead', 'call_click']).optional(),
  status: leadStatusSchema.default('new'),
  dealAmount: z.number().nonnegative().nullable().default(null),
  commissionPercent: z.number().nonnegative().max(MAX_COMMISSION_PERCENT),
  paidAmount: z.number().nonnegative().default(0),
  payments: z.array(paymentSchema).default(() => []),
  incomes: z.array(incomeSchema).default(() => []),
  telegramChatId: z.number().int().nullable().default(null),
  telegramMessageId: z.number().int().nullable().default(null),
  statusChangedAt: z.string(),
  createdAt: z.string(),
  pendingPrompt: pendingPromptSchema.nullable().default(null).catch(null),
  archived: z.boolean().default(false),
  pendingCommissionClaim: pendingCommissionClaimSchema.nullable().default(null),
  remindAt: z.string().nullable().default(null),
});

export type StoredLead = z.infer<typeof baseStoredLeadSchema>;

function migratedIncomes(lead: StoredLead): Income[] {
  if (lead.incomes.length > 0) return lead.incomes;
  const total = lead.dealAmount;
  if (total == null || total <= 0) return [];
  const at = lead.statusChangedAt;
  const paidAt = lead.payments.at(-1)?.at ?? at;
  const commission = incomeCommission(total, lead.commissionPercent);
  const whole = (settledAt: string | null): Income[] => [
    { id: 1, amount: total, at, paidAt: settledAt },
  ];
  if (commission <= 0 || lead.paidAmount <= PAID_EPSILON) return whole(null);
  if (lead.paidAmount >= commission - PAID_EPSILON) return whole(paidAt);
  const covered = roundMoney((total * lead.paidAmount) / commission);
  if (covered >= total) return whole(paidAt);
  return [
    { id: 1, amount: covered, at, paidAt },
    { id: 2, amount: roundMoney(total - covered), at, paidAt: null },
  ];
}

export function withDerivedMoney(lead: StoredLead): StoredLead {
  const incomes = migratedIncomes(lead);
  if (incomes.length === 0) return lead;
  return {
    ...lead,
    incomes,
    dealAmount: roundMoney(incomes.reduce((sum, i) => sum + i.amount, 0)),
    paidAmount: roundMoney(
      incomes.reduce(
        (sum, i) =>
          i.paidAt
            ? sum + incomeCommission(i.amount, lead.commissionPercent)
            : sum,
        0,
      ),
    ),
  };
}

export type LeadInput = Pick<
  StoredLead,
  | 'brand'
  | 'name'
  | 'contact'
  | 'service'
  | 'contactChannel'
  | 'comment'
  | 'country'
  | 'source_url'
  | 'visitorId'
  | 'locale'
  | 'kind'
> &
  Partial<Pick<StoredLead, 'services'>>;

export type LeadSubmission = Omit<LeadInput, 'brand'>;

export interface LeadSchemaOptions {
  defaultCommissionPercent: number;
}

export type StoredLeadSchema = z.ZodType<StoredLead, unknown>;

export function createLeadSchema({
  defaultCommissionPercent,
}: LeadSchemaOptions): StoredLeadSchema {
  if (
    defaultCommissionPercent < 0 ||
    defaultCommissionPercent > MAX_COMMISSION_PERCENT
  ) {
    throw new Error(
      `[lead-crm] defaultCommissionPercent must be between 0 and ${MAX_COMMISSION_PERCENT}`,
    );
  }
  return baseStoredLeadSchema
    .extend({
      commissionPercent: z
        .number()
        .nonnegative()
        .max(MAX_COMMISSION_PERCENT)
        .default(defaultCommissionPercent),
    })
    .transform(withDerivedMoney);
}
