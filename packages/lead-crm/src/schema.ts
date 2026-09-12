import { z } from 'zod';

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

const pendingCommissionClaimSchema = z.object({
  amount: z.number().positive(),
  claimedAt: z.string(),
});
export type PendingCommissionClaim = z.infer<
  typeof pendingCommissionClaimSchema
>;

const baseStoredLeadSchema = z.object({
  id: z.number().int().positive(),
  brand: z.string().max(80),
  name: z.string().max(200),
  contact: z.string().max(200),
  service: z.string().max(200),
  contactChannel: z.string().max(200).nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  country: z.string().max(200).nullable().optional(),
  source_url: z.string().max(500).nullable().optional(),
  visitorId: z.string().max(200).nullable().optional(),
  locale: z.string(),
  kind: z.enum(['lead', 'call_click']).optional(),
  status: leadStatusSchema.default('new'),
  dealAmount: z.number().nonnegative().nullable().default(null),
  commissionPercent: z.number().nonnegative(),
  paidAmount: z.number().nonnegative().default(0),
  payments: z.array(paymentSchema).default(() => []),
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
>;

export type LeadSubmission = Omit<LeadInput, 'brand'>;

export interface LeadSchemaOptions {
  locales: readonly string[];
  defaultCommissionPercent: number;
  defaultBrand: string;
}

export type StoredLeadSchema = z.ZodType<StoredLead, unknown>;

export function createLeadSchema({
  locales,
  defaultCommissionPercent,
  defaultBrand,
}: LeadSchemaOptions): StoredLeadSchema {
  if (locales.length === 0) {
    throw new Error('[lead-crm] locales must not be empty');
  }
  if (defaultCommissionPercent < 0) {
    throw new Error('[lead-crm] defaultCommissionPercent must not be negative');
  }
  if (!defaultBrand) {
    throw new Error('[lead-crm] defaultBrand must not be empty');
  }
  return baseStoredLeadSchema.extend({
    brand: z.string().default(defaultBrand),
    locale: z.enum(locales as readonly [string, ...string[]]),
    commissionPercent: z
      .number()
      .nonnegative()
      .default(defaultCommissionPercent),
  });
}
