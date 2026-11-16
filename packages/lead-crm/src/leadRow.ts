import {
  Prisma,
  type Lead as LeadRow,
  type $Enums,
} from './generated/prisma/client.ts';
import {
  adSourceSchema,
  inWorkStatusSchema,
  type StoredLead,
} from './schema.ts';

const upper = <T extends string>(value: T) =>
  value.toUpperCase() as Uppercase<T>;
const lower = <T extends string>(value: T) =>
  value.toLowerCase() as Lowercase<T>;

const big = (value: number | null) => (value == null ? null : BigInt(value));
const num = (value: bigint | null) => (value == null ? null : Number(value));
const iso = (value: Date | null) => value?.toISOString() ?? null;
const at = (value: string | null | undefined) =>
  value == null ? null : new Date(value);
const day = (value: string | null) =>
  value == null ? null : new Date(`${value}T00:00:00Z`);

const ADVANCED: $Enums.LeadStatus[] = ['NEGOTIATIONS', 'IN_PROGRESS'];

const storedAdSource = adSourceSchema.nullable().catch(null);
const storedPostponedFrom = inWorkStatusSchema.nullable().catch(null);

export function toStoredLead(row: LeadRow): StoredLead {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    contact: row.contact,
    service: row.service,
    services: row.services,
    contactChannel: row.contactChannel,
    comment: row.comment,
    country: row.country,
    source_url: row.sourceUrl,
    visitorId: row.visitorId,
    locale: row.locale,
    kind: row.kind ? lower(row.kind) : undefined,
    status: lower(row.status),
    telegramChatId: num(row.telegramChatId),
    telegramMessageId: row.telegramMessageId,
    statusChangedAt: row.statusChangedAt.toISOString(),
    lastActivityAt:
      iso(row.lastActivityAt) ??
      (ADVANCED.includes(row.status)
        ? row.statusChangedAt.toISOString()
        : null),
    visitorActiveAt: iso(row.visitorActiveAt) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    pendingPrompt:
      row.pendingPromptChatId != null &&
      row.pendingPromptMessageId != null &&
      row.pendingPromptKind
        ? {
            chatId: Number(row.pendingPromptChatId),
            messageId: row.pendingPromptMessageId,
            kind: lower(row.pendingPromptKind),
          }
        : null,
    capturePrompt:
      row.capturePromptChatId != null && row.capturePromptStep
        ? {
            chatId: Number(row.capturePromptChatId),
            step: lower(row.capturePromptStep),
          }
        : null,
    telegramId: num(row.telegramId),
    topicId: row.topicId,
    topicMessageId: row.topicMessageId,
    topicClosed: row.topicClosed,
    topicActiveAt: iso(row.topicActiveAt),
    questionnaireDone: row.questionnaireDone,
    referredBy: row.referredBy ? lower(row.referredBy) : null,
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
    orderSettled: row.orderSettled ? lower(row.orderSettled) : undefined,
    orderConflict: row.orderConflict ? lower(row.orderConflict) : undefined,
    orderStuck: row.orderStuck ? lower(row.orderStuck) : undefined,
    remindAt: row.remindAt?.toISOString().slice(0, 10) ?? null,
    postponedFrom: storedPostponedFrom.parse(
      row.postponedFrom && lower(row.postponedFrom),
    ),
  };
}

type Mappers = {
  [K in keyof StoredLead]?: (
    value: StoredLead[K],
  ) => Partial<Prisma.LeadUncheckedCreateInput>;
};

const outcome = (value: 'won' | 'lost' | undefined) =>
  value ? upper(value) : null;

const MAPPERS: Mappers = {
  id: (id) => ({ id }),
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
  kind: (kind) => ({ kind: kind ? upper(kind) : null }),
  status: (status) => ({ status: upper(status) }),
  telegramChatId: (id) => ({ telegramChatId: big(id) }),
  telegramMessageId: (telegramMessageId) => ({ telegramMessageId }),
  statusChangedAt: (value) => ({ statusChangedAt: new Date(value) }),
  lastActivityAt: (value) => ({ lastActivityAt: at(value) }),
  visitorActiveAt: (value) => ({ visitorActiveAt: at(value) }),
  createdAt: (value) => ({ createdAt: new Date(value) }),
  pendingPrompt: (prompt) => ({
    pendingPromptChatId: big(prompt?.chatId ?? null),
    pendingPromptMessageId: prompt?.messageId ?? null,
    pendingPromptKind: prompt ? upper(prompt.kind) : null,
  }),
  capturePrompt: (prompt) => ({
    capturePromptChatId: big(prompt?.chatId ?? null),
    capturePromptStep: prompt ? upper(prompt.step) : null,
  }),
  telegramId: (id) => ({ telegramId: big(id) }),
  topicId: (topicId) => ({ topicId }),
  topicMessageId: (topicMessageId) => ({ topicMessageId }),
  topicClosed: (topicClosed) => ({ topicClosed }),
  topicActiveAt: (value) => ({ topicActiveAt: at(value) }),
  questionnaireDone: (questionnaireDone) => ({ questionnaireDone }),
  referredBy: (referredBy) => ({
    referredBy: referredBy ? upper(referredBy) : null,
  }),
  managerHandoff: (handoff) => ({
    managerHandoffAt: at(handoff?.at),
    managerHandoffHandle: handoff?.handle ?? null,
  }),
  adSource: (adSource) => ({ adSource: adSource ?? Prisma.DbNull }),
  metaIds: (ids) => ({ metaFbc: ids?.fbc ?? null, metaFbp: ids?.fbp ?? null }),
  metaLeadSentAt: (value) => ({ metaLeadSentAt: at(value) }),
  orderId: (orderId) => ({ orderId: orderId ?? null }),
  orderSettled: (value) => ({ orderSettled: outcome(value) }),
  orderConflict: (value) => ({ orderConflict: outcome(value) }),
  orderStuck: (value) => ({ orderStuck: outcome(value) }),
  remindAt: (value) => ({ remindAt: day(value) }),
  postponedFrom: (value) => ({
    postponedFrom: value ? upper(value) : null,
  }),
};

export function leadData(
  lead: Partial<StoredLead>,
): Prisma.LeadUncheckedCreateInput {
  const data: Partial<Prisma.LeadUncheckedCreateInput> = {};
  for (const key of Object.keys(lead) as (keyof StoredLead)[]) {
    const mapper = MAPPERS[key] as
      | ((value: unknown) => Partial<Prisma.LeadUncheckedCreateInput>)
      | undefined;
    if (mapper) Object.assign(data, mapper(lead[key]));
  }
  return data as Prisma.LeadUncheckedCreateInput;
}

export const CLOSED: $Enums.LeadStatus[] = ['WON', 'LOST'];
