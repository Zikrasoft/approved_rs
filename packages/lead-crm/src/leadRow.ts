import {
  Prisma,
  type Lead,
  type LeadNote as LeadNoteRow,
  type $Enums,
} from './generated/prisma/client.ts';
import {
  adSourceSchema,
  leadIdSchema,
  inWorkStatusSchema,
  type CapturePrompt,
  type MessageKey,
  type PendingPrompt,
  type StoredLead,
} from './schema.ts';

const big = (value: number | null) => (value == null ? null : BigInt(value));
const num = (value: bigint | null) => (value == null ? null : Number(value));
const iso = (value: Date | null) => value?.toISOString() ?? null;
const at = (value: string | null | undefined) =>
  value == null ? null : new Date(value);
const day = (value: string | null) =>
  value == null ? null : new Date(`${value}T00:00:00Z`);

const ADVANCED: $Enums.LeadStatus[] = ['negotiations', 'in_progress'];

const storedAdSource = adSourceSchema.nullable().catch(null);
const storedPostponedFrom = inWorkStatusSchema.nullable().catch(null);

export const WITH_NOTES = {
  notes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.LeadInclude;

export type LeadRow = Lead & { notes: LeadNoteRow[] };

type LeadColumns = Partial<Prisma.LeadUncheckedCreateInput>;

function messageKey(
  chatId: bigint | null,
  messageId: number | null,
): MessageKey | null {
  return chatId != null && messageId != null
    ? { chatId: Number(chatId), messageId }
    : null;
}

const telegramCard = {
  read: (row: Lead) => messageKey(row.telegramChatId, row.telegramMessageId),
  write: (card: MessageKey | null): LeadColumns => ({
    telegramChatId: big(card?.chatId ?? null),
    telegramMessageId: card?.messageId ?? null,
  }),
};

const pendingPrompt = {
  read: (row: Lead): PendingPrompt | null => {
    const key = messageKey(row.pendingPromptChatId, row.pendingPromptMessageId);
    return key && row.pendingPromptKind
      ? { ...key, kind: row.pendingPromptKind }
      : null;
  },
  write: (prompt: PendingPrompt | null): LeadColumns => ({
    pendingPromptChatId: big(prompt?.chatId ?? null),
    pendingPromptMessageId: prompt?.messageId ?? null,
    pendingPromptKind: prompt?.kind ?? null,
  }),
};

const capturePrompt = {
  read: (row: Lead): CapturePrompt | null =>
    row.capturePromptChatId != null && row.capturePromptStep
      ? { chatId: Number(row.capturePromptChatId), step: row.capturePromptStep }
      : null,
  write: (prompt: CapturePrompt | null): LeadColumns => ({
    capturePromptChatId: big(prompt?.chatId ?? null),
    capturePromptStep: prompt?.step ?? null,
  }),
};

export function toStoredLead(row: LeadRow): StoredLead {
  return {
    id: leadIdSchema.parse(row.id),
    number: row.number,
    brand: row.brand,
    name: row.name,
    contact: row.contact,
    service: row.service,
    services: row.services,
    contactChannel: row.contactChannel,
    comment: row.comment,
    notes: row.notes.map((note) => ({
      author: note.author,
      text: note.text,
      createdAt: note.createdAt.toISOString(),
    })),
    country: row.country,
    source_url: row.sourceUrl,
    visitorId: row.visitorId,
    locale: row.locale,
    kind: row.kind ?? undefined,
    status: row.status,
    telegramCard: telegramCard.read(row),
    statusChangedAt: row.statusChangedAt.toISOString(),
    lastActivityAt:
      iso(row.lastActivityAt) ??
      (ADVANCED.includes(row.status)
        ? row.statusChangedAt.toISOString()
        : null),
    visitorActiveAt: iso(row.visitorActiveAt) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    pendingPrompt: pendingPrompt.read(row),
    capturePrompt: capturePrompt.read(row),
    telegramId: num(row.telegramId),
    topicId: row.topicId,
    topicMessageId: row.topicMessageId,
    topicClosed: row.topicClosed,
    topicActiveAt: iso(row.topicActiveAt),
    questionnaireDone: row.questionnaireDone,
    referredBy: row.referredBy,
    managerHandoff:
      row.managerHandoffAt && row.managerHandoffHandle
        ? {
            at: row.managerHandoffAt.toISOString(),
            handle: row.managerHandoffHandle,
          }
        : null,
    adSource: storedAdSource.parse(row.adSource),
    metaIds:
      row.metaFbc != null || row.metaFbp != null
        ? {
            ...(row.metaFbc != null && { fbc: row.metaFbc }),
            ...(row.metaFbp != null && { fbp: row.metaFbp }),
          }
        : null,
    metaLeadSentAt: iso(row.metaLeadSentAt),
    orderId: row.orderId,
    orderSettled: row.orderSettled ?? undefined,
    orderConflict: row.orderConflict ?? undefined,
    orderStuck: row.orderStuck ?? undefined,
    remindAt: row.remindAt?.toISOString().slice(0, 10) ?? null,
    postponedFrom: storedPostponedFrom.parse(row.postponedFrom),
  };
}

type Mappers = {
  [K in keyof StoredLead]?: (value: StoredLead[K]) => LeadColumns;
};

const MAPPERS: Mappers = {
  id: (id) => ({ id }),
  number: (number) => (number == null ? {} : { number }),
  brand: (brand) => ({ brand }),
  name: (name) => ({ name }),
  contact: (contact) => ({ contact }),
  service: (service) => ({ service }),
  services: (services) => ({ services }),
  contactChannel: (contactChannel) => ({
    contactChannel: contactChannel ?? null,
  }),
  comment: (comment) => ({ comment: comment ?? null }),
  country: (country) => ({ country: country ?? null }),
  source_url: (sourceUrl) => ({ sourceUrl: sourceUrl ?? null }),
  visitorId: (visitorId) => ({ visitorId: visitorId ?? null }),
  locale: (locale) => ({ locale }),
  kind: (kind) => ({ kind: kind ?? null }),
  status: (status) => ({ status }),
  telegramCard: telegramCard.write,
  statusChangedAt: (value) => ({ statusChangedAt: new Date(value) }),
  lastActivityAt: (value) => ({ lastActivityAt: at(value) }),
  visitorActiveAt: (value) => ({ visitorActiveAt: at(value) }),
  createdAt: (value) => ({ createdAt: new Date(value) }),
  pendingPrompt: pendingPrompt.write,
  capturePrompt: capturePrompt.write,
  telegramId: (id) => ({ telegramId: big(id) }),
  topicId: (topicId) => ({ topicId }),
  topicMessageId: (topicMessageId) => ({ topicMessageId }),
  topicClosed: (topicClosed) => ({ topicClosed }),
  topicActiveAt: (value) => ({ topicActiveAt: at(value) }),
  questionnaireDone: (questionnaireDone) => ({ questionnaireDone }),
  referredBy: (referredBy) => ({ referredBy: referredBy ?? null }),
  managerHandoff: (handoff) => ({
    managerHandoffAt: at(handoff?.at),
    managerHandoffHandle: handoff?.handle ?? null,
  }),
  adSource: (adSource) => ({ adSource: adSource ?? Prisma.DbNull }),
  metaIds: (ids) => ({ metaFbc: ids?.fbc ?? null, metaFbp: ids?.fbp ?? null }),
  metaLeadSentAt: (value) => ({ metaLeadSentAt: at(value) }),
  orderId: (orderId) => ({ orderId: orderId ?? null }),
  orderSettled: (orderSettled) => ({ orderSettled: orderSettled ?? null }),
  orderConflict: (orderConflict) => ({ orderConflict: orderConflict ?? null }),
  orderStuck: (orderStuck) => ({ orderStuck: orderStuck ?? null }),
  remindAt: (value) => ({ remindAt: day(value) }),
  postponedFrom: (postponedFrom) => ({ postponedFrom: postponedFrom ?? null }),
};

export function leadData(
  lead: Partial<StoredLead>,
): Prisma.LeadUncheckedCreateInput {
  const data: LeadColumns = {};
  for (const key of Object.keys(lead) as (keyof StoredLead)[]) {
    const mapper = MAPPERS[key] as
      ((value: unknown) => LeadColumns) | undefined;
    if (mapper) Object.assign(data, mapper(lead[key]));
  }
  return data as Prisma.LeadUncheckedCreateInput;
}

export const CLOSED: $Enums.LeadStatus[] = ['won', 'lost'];
