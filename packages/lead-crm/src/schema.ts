import { z } from 'zod';
import { cleanAdText } from './adText.ts';
import { TRACKED_CONTACT_CHANNELS } from './contactChannel.ts';

export const leadIdSchema = z.uuid().brand<'LeadId'>();
export type LeadId = z.infer<typeof leadIdSchema>;

export const LEAD_STATUSES = [
  'new',
  'negotiations',
  'in_progress',
  'won',
  'lost',
  'postponed',
] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

const IN_WORK_STATUSES = ['new', 'negotiations', 'in_progress'] as const;
export const inWorkStatusSchema = z.enum(IN_WORK_STATUSES);
export type InWorkStatus = z.infer<typeof inWorkStatusSchema>;

export const PROMPT_KINDS = [
  'postpone',
  'edit_name',
  'edit_contact',
  'note',
] as const;

const messageKeySchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
});
export type MessageKey = z.infer<typeof messageKeySchema>;

const pendingPromptSchema = messageKeySchema.extend({
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

const staffRoleSchema = z.enum(['owner', 'admin']);
export type StaffRole = z.infer<typeof staffRoleSchema>;

const leadNoteSchema = z.object({
  author: staffRoleSchema,
  text: z.string(),
  createdAt: z.string(),
});
export type LeadNote = z.infer<typeof leadNoteSchema>;
export type NewLeadNote = Omit<LeadNote, 'createdAt'>;

export const REFERRERS = ['approved'] as const;

export type Referrer = (typeof REFERRERS)[number];

export const storedLeadFieldsSchema = z.object({
  number: z.number().int().positive().nullable().default(null),
  brand: z.string(),
  name: z.string(),
  contact: z.string(),
  service: z.string(),
  services: z.array(z.string()).default([]),
  contactChannel: z.enum(TRACKED_CONTACT_CHANNELS).nullable().optional(),
  comment: z.string().nullable().optional(),
  notes: z.array(leadNoteSchema).default([]),
  country: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  visitorId: z.string().nullable().optional(),
  locale: z.string(),
  kind: z.enum(['lead', 'call_click']).optional(),
  status: leadStatusSchema.default('new'),
  telegramCard: messageKeySchema.nullable().default(null),
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
  orderId: z.string().nullable().optional().catch(undefined),
  orderSettled: z.enum(['won', 'lost']).optional().catch(undefined),
  orderConflict: z.enum(['won', 'lost']).optional().catch(undefined),
  orderStuck: z.enum(['won', 'lost']).optional().catch(undefined),
  remindAt: z.string().nullable().default(null),
  postponedFrom: inWorkStatusSchema.nullable().default(null).catch(null),
});

export const storedLeadSchema = storedLeadFieldsSchema.extend({
  id: leadIdSchema,
});

export type StoredLead = z.infer<typeof storedLeadSchema>;

export function isClosed(lead: Pick<StoredLead, 'status'>): boolean {
  return lead.status === 'won' || lead.status === 'lost';
}

export function isInWork(lead: Pick<StoredLead, 'status'>): boolean {
  return inWorkStatusSchema.safeParse(lead.status).success;
}

export function inWorkStatus(lead: Pick<StoredLead, 'status'>): InWorkStatus {
  return inWorkStatusSchema.parse(lead.status);
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
      | 'orderId'
    >
  >;

export type LeadSubmission = Omit<LeadInput, 'brand'>;
