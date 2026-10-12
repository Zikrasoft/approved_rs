import { z } from 'zod';
import { cleanAdText } from './adText.ts';

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

const IN_WORK_STATUSES = ['new', 'negotiations', 'in_progress'] as const;
const inWorkStatusSchema = z.enum(IN_WORK_STATUSES);
export type InWorkStatus = z.infer<typeof inWorkStatusSchema>;

const storedStatusSchema = z.enum([...LEAD_STATUSES, 'open']);

export const PROMPT_KINDS = [
  'postpone',
  'edit_name',
  'edit_contact',
  'note',
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

const managerHandoffSchema = z.object({
  at: z.string(),
  handle: z.string().min(1),
});
export type ManagerHandoff = z.infer<typeof managerHandoffSchema>;

const adTextSchema = z
  .string()
  .transform(cleanAdText)
  .optional()
  .catch(undefined);

export const adSourceSchema = z
  .object({
    source: adTextSchema,
    medium: adTextSchema,
    campaign: adTextSchema,
    content: adTextSchema,
    at: z.iso.datetime(),
  })
  .refine(({ source, medium, campaign, content }) =>
    [source, medium, campaign, content].some(Boolean),
  );
export type AdSource = z.infer<typeof adSourceSchema>;

const metaIdSchema = z
  .string()
  .regex(/^fb\.\d\.\d{10,13}\.[\w.-]{1,500}$/)
  .optional()
  .catch(undefined);

export const metaIdsSchema = z
  .object({ fbc: metaIdSchema, fbp: metaIdSchema })
  .refine(({ fbc, fbp }) => fbc != null || fbp != null);
export type MetaIds = z.infer<typeof metaIdsSchema>;

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
  status: storedStatusSchema.default('new'),
  telegramChatId: z.number().int().nullable().default(null),
  telegramMessageId: z.number().int().nullable().default(null),
  statusChangedAt: z.string(),
  lastActivityAt: z.string().nullable().default(null),
  visitorActiveAt: z.string().optional(),
  createdAt: z.string(),
  pendingPrompt: pendingPromptSchema.nullable().default(null).catch(null),
  capturePrompt: capturePromptSchema.nullable().default(null).catch(null),
  telegramId: z.number().int().nullable().default(null).catch(null),
  topicId: z.number().int().nullable().default(null).catch(null),
  topicMessageId: z.number().int().nullable().default(null).catch(null),
  topicClosed: z.boolean().default(false).catch(false),
  topicActiveAt: z.string().nullable().default(null).catch(null),
  questionnaireDone: z.boolean().default(false).catch(false),
  referredBy: z.enum(REFERRERS).nullable().default(null).catch(null),
  managerHandoff: managerHandoffSchema.nullable().default(null).catch(null),
  adSource: adSourceSchema.nullable().default(null).catch(null),
  metaIds: metaIdsSchema.nullable().default(null).catch(null),
  metaLeadSentAt: z.string().nullable().default(null).catch(null),
  archived: z.boolean().optional(),
  remindAt: z.string().nullable().default(null),
  postponedFrom: inWorkStatusSchema.nullable().default(null).catch(null),
});

type StoredShape = z.infer<typeof baseStoredLeadSchema>;

export type StoredLead = Omit<StoredShape, 'archived' | 'status'> & {
  status: LeadStatus;
};

export function isClosed(lead: Pick<StoredLead, 'status'>): boolean {
  return lead.status === 'won' || lead.status === 'lost';
}

export function isInWork(lead: Pick<StoredLead, 'status'>): boolean {
  return inWorkStatusSchema.safeParse(lead.status).success;
}

export function inWorkStatus(lead: Pick<StoredLead, 'status'>): InWorkStatus {
  return inWorkStatusSchema.parse(lead.status);
}

function withCurrentStatuses({
  archived,
  status,
  ...lead
}: StoredShape): StoredLead {
  const advanced = status === 'negotiations' || status === 'in_progress';
  const current = leadStatusSchema.catch('new').parse(status);
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
    Pick<
      StoredLead,
      | 'services'
      | 'capturePrompt'
      | 'telegramId'
      | 'referredBy'
      | 'adSource'
      | 'metaIds'
    >
  >;

export type LeadSubmission = Omit<LeadInput, 'brand'>;

export type StoredLeadSchema = z.ZodType<StoredLead, unknown>;

export const storedLeadSchema: StoredLeadSchema =
  baseStoredLeadSchema.transform(withCurrentStatuses);
