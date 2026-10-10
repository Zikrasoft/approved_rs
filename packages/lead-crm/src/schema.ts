import { z } from 'zod';

export const LEAD_STATUSES = ['open', 'won', 'lost', 'postponed'] as const;
const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

const storedStatusSchema = z.enum([
  ...LEAD_STATUSES,
  'new',
  'negotiations',
  'in_progress',
]);

export const PROMPT_KINDS = [
  'deal_amount',
  'postpone',
  'reply_visitor',
] as const;

const pendingPromptSchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
  kind: z.enum(PROMPT_KINDS),
});
export type PendingPrompt = z.infer<typeof pendingPromptSchema>;

export const CAPTURE_STEPS = [
  'looking_for',
  'budget',
  'phone',
  'car_issue',
  'car',
  'service',
] as const;
export type CaptureStep = (typeof CAPTURE_STEPS)[number];

const capturePromptSchema = z.object({
  chatId: z.number().int(),
  step: z.enum(CAPTURE_STEPS),
});
export type CapturePrompt = z.infer<typeof capturePromptSchema>;

export const LEGACY_BRAND = 'Approved.rs';

export const REFERRERS = ['approved'] as const;

export type Referrer = (typeof REFERRERS)[number];

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
  status: storedStatusSchema.default('open'),
  telegramChatId: z.number().int().nullable().default(null),
  telegramMessageId: z.number().int().nullable().default(null),
  statusChangedAt: z.string(),
  lastActivityAt: z.string().nullable().default(null),
  createdAt: z.string(),
  pendingPrompt: pendingPromptSchema.nullable().default(null).catch(null),
  capturePrompt: capturePromptSchema.nullable().default(null).catch(null),
  telegramId: z.number().int().nullable().default(null).catch(null),
  referredBy: z.enum(REFERRERS).nullable().default(null).catch(null),
  archived: z.boolean().optional(),
  remindAt: z.string().nullable().default(null),
});

type StoredShape = z.infer<typeof baseStoredLeadSchema>;

export type StoredLead = Omit<StoredShape, 'archived' | 'status'> & {
  status: LeadStatus;
};

export function isClosed(lead: Pick<StoredLead, 'status'>): boolean {
  return lead.status === 'won' || lead.status === 'lost';
}

function withFourStatuses({
  archived,
  status,
  ...lead
}: StoredShape): StoredLead {
  const advanced = status === 'negotiations' || status === 'in_progress';
  const current = leadStatusSchema.catch('open').parse(status);
  return {
    ...lead,
    status: archived && !isClosed({ status: current }) ? 'lost' : current,
    lastActivityAt:
      lead.lastActivityAt ?? (advanced ? lead.statusChangedAt : null),
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
  Partial<
    Pick<StoredLead, 'services' | 'capturePrompt' | 'telegramId' | 'referredBy'>
  >;

export type LeadSubmission = Omit<LeadInput, 'brand'>;

export type StoredLeadSchema = z.ZodType<StoredLead, unknown>;

export const storedLeadSchema: StoredLeadSchema =
  baseStoredLeadSchema.transform(withFourStatuses);
