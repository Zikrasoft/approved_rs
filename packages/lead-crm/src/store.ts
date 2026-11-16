import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { logError } from './logError.ts';
import { isPhoneContact } from './contactShape.ts';
import { inWorkStatus, isClosed, isInWork } from './schema.ts';
import type {
  CapturePrompt,
  Referrer,
  LeadInput,
  LeadStatus,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
import type { PromptKey } from './promptKey.ts';
import { storedLeadSchema } from './schema.ts';
import { FAILED_CHECKOUTS_PER_CONTACT_HOUR } from './limits.ts';
import {
  isUniqueViolation,
  lockKey,
  type CrmDatabase,
  type CrmTransaction,
} from './database.ts';
import { CLOSED, leadData, toStoredLead } from './leadRow.ts';
import { Prisma } from './generated/prisma/client.ts';
import { businessDay, DAY_MS } from './businessTime.ts';
import {
  appendNote,
  hasRealContact,
  isPlaceholderContact,
  mergedLead,
} from './leadMerge.ts';

export const VISITOR_MERGE_WINDOW_MS = 60 * 60 * 1000;

export const MAX_LIST_ROWS = 20;

export function isFreshLead(
  lead: StoredLead,
  now: number = Date.now(),
): boolean {
  const lastSeen = Math.max(
    ...[lead.visitorActiveAt, lead.lastActivityAt, lead.createdAt].map((at) =>
      at ? Date.parse(at) : 0,
    ),
  );
  return now - lastSeen < VISITOR_MERGE_WINDOW_MS;
}

export interface CaptureUpdate {
  note?: string;
  contact?: string;
  services?: (picked: string[]) => string[];
  questionnaireDone?: boolean;
  locale?: string;
  referredBy?: Referrer;
  capturePrompt: CapturePrompt | null;
}

export type ClaimedMetaLead = StoredLead & { metaLeadSentAt: string };

export interface MergeOutcome {
  lead: StoredLead;
  merged: boolean;
  before: StoredLead | null;
}

const STALE_AFTER_MS = 7 * DAY_MS;

export interface Digest {
  stale: StoredLead[];
  due: StoredLead[];
}

export interface PostedDigest {
  messageId: number;
  dueIds: string[];
  staleIds: string[];
  hidden: number;
}
export type DigestRows = Omit<PostedDigest, 'messageId'>;

export interface OpenDigest {
  messageId: number;
  digest: Digest;
  hidden: number;
}

function lastActionAt(lead: StoredLead): number {
  return Math.max(
    Date.parse(lead.statusChangedAt),
    lead.lastActivityAt ? Date.parse(lead.lastActivityAt) : 0,
  );
}

function digestOf(leads: StoredLead[], now: Date): Digest {
  const today = businessDay(now);
  return {
    stale: leads.filter(
      (l) => isInWork(l) && now.getTime() - lastActionAt(l) >= STALE_AFTER_MS,
    ),
    due: leads.filter(
      (l) =>
        l.status === 'postponed' && l.remindAt != null && l.remindAt <= today,
    ),
  };
}

export interface LeadStoreOptions {
  database: CrmDatabase;
  alertLeadCount?: (count: number) => Promise<void>;
  standaloneServices?: readonly string[];
}

const HOUR_MS = 60 * 60 * 1000;

export const LEAD_COUNT_ALERTS: readonly number[] = [5000, 10000];

export const GHOST_LEAD_RETENTION_MS = DAY_MS;

export const TOPIC_IDLE_MS = DAY_MS;

function untouched(lead: StoredLead): boolean {
  return lead.status === 'new' && lead.lastActivityAt == null;
}

type MergeTarget =
  | { kind: 'same-order'; lead: StoredLead }
  | { kind: 'failed-checkout'; lead: StoredLead }
  | { kind: 'merge'; lead: StoredLead }
  | { kind: 'new' };

function isFailedCheckoutOf(
  lead: LeadInput,
  standaloneServices: readonly string[],
): boolean {
  return standaloneServices.includes(lead.service) && !lead.orderId;
}

function mergeTarget(
  data: LeadInput,
  leads: StoredLead[],
  now: number,
  standaloneServices: readonly string[],
): MergeTarget {
  const isStandalone = (service: string) =>
    standaloneServices.includes(service);
  const isFailedCheckout = (lead: LeadInput) =>
    isFailedCheckoutOf(lead, standaloneServices);
  const ours = leads.filter((l) => l.brand === data.brand);

  const placed = data.orderId
    ? ours.find((l) => l.orderId === data.orderId)
    : undefined;
  if (placed) return { kind: 'same-order', lead: placed };

  const failed = isStandalone(data.service)
    ? ours
        .filter(
          (l) =>
            isFailedCheckout(l) &&
            !isClosed(l) &&
            isFreshLead(l, now) &&
            ((data.visitorId != null && l.visitorId === data.visitorId) ||
              (hasRealContact(data.contact) && l.contact === data.contact)),
        )
        .at(-1)
    : undefined;
  if (failed) return { kind: 'failed-checkout', lead: failed };

  const apart = (l: StoredLead) =>
    [data.service, l.service].some(isStandalone) &&
    !isPlaceholderContact(data.contact) &&
    !isPlaceholderContact(l.contact);
  const visited = data.visitorId
    ? ours.find(
        (l) =>
          l.visitorId === data.visitorId &&
          untouched(l) &&
          isFreshLead(l, now) &&
          (data.telegramId == null || isPlaceholderContact(l.contact)) &&
          !apart(l),
      )
    : undefined;
  return visited ? { kind: 'merge', lead: visited } : { kind: 'new' };
}

function pickedServices(services: string[]) {
  return { service: services[0] ?? '', services };
}

function isGhostLead(lead: StoredLead, now: Date): boolean {
  return (
    lead.kind === 'call_click' &&
    isPlaceholderContact(lead.contact) &&
    untouched(lead) &&
    now.getTime() - Date.parse(lead.visitorActiveAt ?? lead.createdAt) >=
      GHOST_LEAD_RETENTION_MS
  );
}

export function canPostpone(lead: StoredLead): boolean {
  return isInWork(lead);
}

export function postponePatch(
  lead: StoredLead,
  remindAt: string,
  note: string,
): Partial<StoredLead> {
  return {
    ...statusPatch('postponed'),
    postponedFrom: inWorkStatus(lead),
    remindAt,
    comment: appendNote(lead.comment, note),
  };
}

export function statusPatch(
  to: LeadStatus,
  at: Date = new Date(),
): Pick<StoredLead, 'status' | 'statusChangedAt'> {
  return { status: to, statusChangedAt: at.toISOString() };
}

export function canMoveTo(lead: StoredLead, to: LeadStatus): boolean {
  return isClosed({ status: to }) || !isClosed(lead);
}

export function resumePatch(lead: StoredLead): Partial<StoredLead> {
  return {
    ...statusPatch(lead.postponedFrom ?? 'new'),
    postponedFrom: null,
    remindAt: null,
  };
}

const leadId = z.uuid();

const isLeadId = (id: string) => leadId.safeParse(id).success;

const OPEN_STATUSES = [
  'NEW',
  'NEGOTIATIONS',
  'IN_PROGRESS',
  'POSTPONED',
] as const;

const IN_ORDER: Prisma.LeadOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];
const NEWEST_FIRST: Prisma.LeadOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

const dayOf = (now: Date) => new Date(`${businessDay(now)}T00:00:00Z`);

type LeadPatch = Partial<StoredLead>;

async function lockedLead(
  tx: CrmTransaction,
  where: Prisma.Sql,
): Promise<StoredLead | undefined> {
  const [locked] = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM leads WHERE ${where}
    ORDER BY created_at, id LIMIT 1 FOR UPDATE`;
  if (!locked) return undefined;
  return toStoredLead(
    await tx.lead.findUniqueOrThrow({ where: { id: locked.id } }),
  );
}

function candidatesFor(data: LeadInput): Prisma.Sql {
  const matches = [
    data.visitorId != null && Prisma.sql`visitor_id = ${data.visitorId}`,
    hasRealContact(data.contact) && Prisma.sql`contact = ${data.contact}`,
    data.orderId != null && Prisma.sql`order_id = ${data.orderId}`,
  ].filter((clause) => clause !== false);
  return matches.length
    ? Prisma.sql`brand = ${data.brand} AND (${Prisma.join(matches, ' OR ')})`
    : Prisma.sql`FALSE`;
}

export function createLeadStore({
  database,
  alertLeadCount,
  standaloneServices = [],
}: LeadStoreOptions) {
  function newStoredLead(
    data: LeadInput,
    id: string = randomUUID(),
  ): StoredLead {
    const now = new Date().toISOString();
    return storedLeadSchema.parse({
      ...data,
      id,
      statusChangedAt: now,
      createdAt: now,
    });
  }

  function update(
    where: Prisma.Sql,
    apply: (lead: StoredLead) => LeadPatch | undefined,
  ): Promise<StoredLead | undefined> {
    return database().$transaction(async (tx) => {
      const lead = await lockedLead(tx, where);
      const patch = lead && apply(lead);
      if (!lead || !patch) return undefined;
      return toStoredLead(
        await tx.lead.update({ where: { id: lead.id }, data: leadData(patch) }),
      );
    });
  }

  function updateOne(
    id: string,
    apply: (lead: StoredLead) => LeadPatch | undefined,
  ): Promise<StoredLead | undefined> {
    if (!isLeadId(id)) return Promise.resolve(undefined);
    return update(Prisma.sql`id = ${id}::uuid`, apply);
  }

  function updateOneIfStatus(
    id: string,
    requiredStatus: LeadStatus,
    apply: (lead: StoredLead) => LeadPatch,
  ): Promise<StoredLead | undefined> {
    return updateOne(id, (l) =>
      l.status === requiredStatus ? apply(l) : undefined,
    );
  }

  async function findLeads(
    where: Prisma.LeadWhereInput,
    orderBy = IN_ORDER,
  ): Promise<StoredLead[]> {
    return (await database().lead.findMany({ where, orderBy })).map(
      toStoredLead,
    );
  }

  async function findLead(
    where: Prisma.LeadWhereInput,
  ): Promise<StoredLead | undefined> {
    const row = await database().lead.findFirst({ where, orderBy: IN_ORDER });
    return row ? toStoredLead(row) : undefined;
  }

  async function newestLeads(
    where: Prisma.LeadWhereInput,
  ): Promise<StoredLead[]> {
    return findLeads(where, NEWEST_FIRST);
  }

  async function createLead(
    client: CrmTransaction,
    data: LeadInput,
  ): Promise<StoredLead> {
    const lead = { ...newStoredLead(data), id: undefined };
    return toStoredLead(await client.lead.create({ data: leadData(lead) }));
  }

  async function alertOnThreshold(count: number): Promise<void> {
    if (!alertLeadCount || !LEAD_COUNT_ALERTS.includes(count)) return;
    try {
      await alertLeadCount(count);
    } catch (error) {
      logError('[lead-crm] could not send the Lead count alert', error, {
        count,
      });
    }
  }

  async function releaseCapturePrompts(
    tx: CrmTransaction,
    landed: StoredLead,
  ): Promise<void> {
    if (landed.telegramId == null) return;
    await tx.lead.updateMany({
      where: {
        brand: landed.brand,
        telegramId: BigInt(landed.telegramId),
        id: { not: landed.id },
        capturePromptChatId: { not: null },
      },
      data: { capturePromptChatId: null, capturePromptStep: null },
    });
  }

  const telegramLeads = (telegramId: number, brand: string) => ({
    brand,
    telegramId: BigInt(telegramId),
  });

  return {
    readLeads: () => findLeads({}),

    async getLead(id: string): Promise<StoredLead | undefined> {
      return isLeadId(id) ? findLead({ id }) : undefined;
    },

    newStoredLead,

    insertLead(data: LeadInput): Promise<StoredLead> {
      return createLead(database(), data);
    },

    async failedCheckoutCapped(
      brand: string,
      contact: string,
    ): Promise<boolean> {
      const recent = await database().lead.count({
        where: {
          brand,
          contact,
          service: { in: [...standaloneServices] },
          OR: [{ orderId: null }, { orderId: '' }],
          createdAt: { gte: new Date(Date.now() - HOUR_MS) },
        },
      });
      return recent >= FAILED_CHECKOUTS_PER_CONTACT_HOUR;
    },

    async insertOrMergeLead(data: LeadInput): Promise<MergeOutcome> {
      const { outcome, count } = await database().$transaction(async (tx) => {
        await lockKey(tx, `crm.leads.merge:${data.brand}`);
        const ids = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM leads WHERE ${candidatesFor(data)} FOR UPDATE`;
        const candidates = (
          await tx.lead.findMany({
            where: { id: { in: ids.map(({ id }) => id) } },
            orderBy: IN_ORDER,
          })
        ).map(toStoredLead);
        const now = Date.now();
        const target = mergeTarget(data, candidates, now, standaloneServices);
        if (target.kind === 'same-order') {
          const { lead } = target;
          return { outcome: { lead, merged: true, before: lead }, count: 0 };
        }
        if (target.kind === 'new') {
          const lead = await createLead(tx, data);
          await releaseCapturePrompts(tx, lead);
          const count = await tx.lead.count();
          return { outcome: { lead, merged: false, before: null }, count };
        }
        const existing = target.lead;
        const merged = mergedLead(existing, data, {
          takesOver: target.kind === 'failed-checkout' && data.orderId != null,
          at: new Date(now),
        });
        const stored = toStoredLead(
          await tx.lead.update({
            where: { id: existing.id },
            data: leadData(merged),
          }),
        );
        if (data.telegramId != null) await releaseCapturePrompts(tx, stored);
        return {
          outcome: { lead: stored, merged: true, before: existing },
          count: 0,
        };
      });
      await alertOnThreshold(count);
      return outcome;
    },

    setTelegramMessage(
      id: string,
      chatId: number,
      messageId: number,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({
        telegramChatId: chatId,
        telegramMessageId: messageId,
      }));
    },

    setTopic(id: string, topicId: number): Promise<StoredLead | undefined> {
      return updateOne(id, (l) =>
        l.topicId != null
          ? {}
          : {
              topicId,
              topicMessageId: null,
              topicClosed: false,
              topicActiveAt: null,
            },
      );
    },

    setTopicSummary(
      id: string,
      topicMessageId: number,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({ topicMessageId }));
    },

    touchTopic(
      id: string,
      at: Date = new Date(),
    ): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({
        topicClosed: false,
        topicActiveAt: at.toISOString(),
      }));
    },

    closeTopic(id: string): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({ topicClosed: true }));
    },

    setStatus(id: string, status: LeadStatus): Promise<StoredLead | undefined> {
      return updateOne(id, (l) =>
        canMoveTo(l, status)
          ? {
              ...(l.status === 'postponed' ? resumePatch(l) : {}),
              ...statusPatch(status),
            }
          : undefined,
      );
    },

    settleOrder(
      id: string,
      status: 'won' | 'lost',
    ): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, status, () => ({ orderSettled: status }));
    },

    markOrderConflict(
      id: string,
      status: 'won' | 'lost',
    ): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, status, () => ({ orderConflict: status }));
    },

    markOrderStuck(
      id: string,
      status: 'won' | 'lost',
    ): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, status, () => ({ orderStuck: status }));
    },

    findByOrderId(orderId: string): Promise<StoredLead | undefined> {
      return findLead({ orderId });
    },

    findUnsettledOrderLeads(): Promise<StoredLead[]> {
      return findLeads({ orderId: { not: null }, status: { in: CLOSED } });
    },

    loseOrderLead(orderId: string): Promise<StoredLead | undefined> {
      return update(
        Prisma.sql`order_id = ${orderId} AND status <> 'WON'`,
        (l) => ({
          ...(l.status === 'lost'
            ? {}
            : {
                ...(l.status === 'postponed' ? resumePatch(l) : {}),
                ...statusPatch('lost'),
              }),
          orderSettled: 'lost',
        }),
      );
    },

    recordOwnerReply(
      id: string,
      at: Date = new Date(),
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({
        lastActivityAt: at.toISOString(),
        ...(l.status === 'new' ? statusPatch('negotiations', at) : {}),
      }));
    },

    touchLead(
      id: string,
      at: Date = new Date(),
    ): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({ lastActivityAt: at.toISOString() }));
    },

    setPendingPrompt(
      id: string,
      prompt: PendingPrompt | null,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, () => ({ pendingPrompt: prompt }));
    },

    findByPendingPrompt({
      chatId,
      messageId,
    }: PromptKey): Promise<StoredLead | undefined> {
      return findLead({
        pendingPromptChatId: BigInt(chatId),
        pendingPromptMessageId: messageId,
      });
    },

    findByTopic(topicId: number): Promise<StoredLead | undefined> {
      return findLead({ topicId });
    },

    resolvePendingPrompt(
      { chatId, messageId }: PromptKey,
      apply: (lead: StoredLead) => LeadPatch,
    ): Promise<StoredLead | undefined> {
      return update(
        Prisma.sql`pending_prompt_chat_id = ${BigInt(chatId)} AND pending_prompt_message_id = ${messageId}`,
        (l) => ({
          lastActivityAt: new Date().toISOString(),
          ...apply(l),
          pendingPrompt: null,
        }),
      );
    },

    updateCapture(
      id: string,
      {
        note,
        contact,
        services,
        questionnaireDone,
        locale,
        referredBy,
        capturePrompt,
      }: CaptureUpdate,
    ): Promise<StoredLead | undefined> {
      const now = new Date().toISOString();
      return updateOne(id, (l) => ({
        comment: note ? appendNote(l.comment, note) : l.comment,
        contact: contact ?? l.contact,
        ...(services ? pickedServices(services(l.services)) : {}),
        questionnaireDone: questionnaireDone ?? l.questionnaireDone,
        locale: locale ?? l.locale,
        referredBy: referredBy ?? l.referredBy,
        capturePrompt,
        visitorActiveAt: now,
      }));
    },

    markManagerHandoff(
      id: string,
      handle: string,
    ): Promise<StoredLead | undefined> {
      const at = new Date().toISOString();
      return updateOne(id, (l) =>
        l.managerHandoff == null
          ? { managerHandoff: { at, handle }, visitorActiveAt: at }
          : undefined,
      );
    },

    async claimMetaLead(id: string): Promise<ClaimedMetaLead | undefined> {
      const at = new Date().toISOString();
      const claimed = await updateOne(id, (l) =>
        l.metaIds != null && l.metaLeadSentAt == null
          ? { metaLeadSentAt: at }
          : undefined,
      );
      return claimed && { ...claimed, metaLeadSentAt: at };
    },

    async findOpenLeadByTelegramId(
      telegramId: number,
      brand: string,
    ): Promise<StoredLead | undefined> {
      const [newest] = await newestLeads({
        ...telegramLeads(telegramId, brand),
        status: { notIn: CLOSED },
      });
      return newest;
    },

    async findLatestLeadByTelegramId(
      telegramId: number,
      brand: string,
    ): Promise<StoredLead | undefined> {
      const leads = await newestLeads(telegramLeads(telegramId, brand));
      return leads.find((l) => !isClosed(l)) ?? leads[0];
    },

    async findPhoneByTelegramId(
      telegramId: number,
      brand: string,
    ): Promise<string | undefined> {
      const leads = await newestLeads(telegramLeads(telegramId, brand));
      return leads.find((l) => isPhoneContact(l.contact))?.contact;
    },

    async findByCapturePrompt(
      chatId: number,
      brand: string,
    ): Promise<StoredLead | undefined> {
      const leads = await newestLeads({
        brand,
        capturePromptChatId: BigInt(chatId),
        status: { notIn: CLOSED },
      });
      return leads.find((l) => isFreshLead(l));
    },

    resumeLead(id: string): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, 'postponed', resumePatch);
    },

    postponeLead(
      id: string,
      remindAt: string,
      note: string,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) =>
        canPostpone(l) ? postponePatch(l, remindAt, note) : undefined,
      );
    },

    async deleteLead(id: string): Promise<boolean> {
      if (!isLeadId(id)) return false;
      const { count } = await database().lead.deleteMany({ where: { id } });
      return count > 0;
    },

    async searchLeads(query: string, limit = 10): Promise<StoredLead[]> {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const number = q.replace(/^#/, '');
      const rows = await database().lead.findMany({ orderBy: NEWEST_FIRST });
      return rows
        .filter(
          (l) =>
            l.id === q ||
            String(l.number) === number ||
            l.name.toLowerCase().includes(q) ||
            l.contact.toLowerCase().includes(q) ||
            (l.comment ?? '').toLowerCase().includes(q),
        )
        .slice(0, limit)
        .map(toStoredLead);
    },

    async claimDigest(now: Date): Promise<Digest | undefined> {
      const day = dayOf(now);
      if (await database().digest.findUnique({ where: { day } }))
        return undefined;
      const claimed = digestOf(
        await findLeads({ status: { in: [...OPEN_STATUSES] } }),
        now,
      );
      if (Object.values(claimed).every((list) => list.length === 0))
        return claimed;
      try {
        await database().$transaction([
          database().digest.create({ data: { day, createdAt: now } }),
          database().digest.deleteMany({ where: { day: { not: day } } }),
        ]);
      } catch (error) {
        if (isUniqueViolation(error)) return undefined;
        throw error;
      }
      return claimed;
    },

    async recordDigestMessage(
      now: Date,
      { messageId, hidden, dueIds, staleIds }: PostedDigest,
    ): Promise<void> {
      await database().$transaction(async (tx) => {
        const day = dayOf(now);
        if (!(await tx.digest.findUnique({ where: { day } }))) return;
        const digest = await tx.digest.update({
          where: { day },
          data: { messageId, hidden },
        });
        const existing = new Set(
          (
            await tx.lead.findMany({
              where: { id: { in: [...dueIds, ...staleIds] } },
              select: { id: true },
            })
          ).map(({ id }) => id),
        );
        const entries = (list: 'DUE' | 'STALE', ids: string[]) =>
          ids.map((leadId, position) => ({
            digestId: digest.id,
            leadId,
            list,
            position,
          }));
        await tx.digestLead.createMany({
          data: [
            ...entries('DUE', dueIds),
            ...entries('STALE', staleIds),
          ].filter((entry) => existing.has(entry.leadId)),
        });
      });
    },

    takeFromDigest(leadId: string): Promise<OpenDigest | undefined> {
      return database().$transaction(async (tx) => {
        const [latest] = await tx.$queryRaw<
          { id: string; message_id: number | null; hidden: number | null }[]
        >`SELECT id, message_id, hidden FROM digests ORDER BY day DESC LIMIT 1 FOR UPDATE`;
        if (!latest || latest.message_id == null) return undefined;
        const entries = await tx.digestLead.findMany({
          where: { digestId: latest.id },
          orderBy: { position: 'asc' },
          include: { lead: true },
        });
        if (!entries.some((entry) => entry.leadId === leadId)) return undefined;
        const kept = entries
          .map((entry) => ({
            list: entry.list,
            lead: toStoredLead(entry.lead),
          }))
          .filter(({ lead }) => lead.id !== leadId && isInWork(lead));
        await tx.digestLead.deleteMany({
          where: {
            digestId: latest.id,
            leadId: { notIn: kept.map(({ lead }) => lead.id) },
          },
        });
        const listed = (list: 'DUE' | 'STALE') =>
          kept.filter((entry) => entry.list === list).map(({ lead }) => lead);
        return {
          messageId: latest.message_id,
          digest: { due: listed('DUE'), stale: listed('STALE') },
          hidden: latest.hidden ?? 0,
        };
      });
    },

    async releaseDigest(now: Date): Promise<void> {
      await database().digest.deleteMany({ where: { day: dayOf(now) } });
    },

    async expireGhostLeads(now: Date): Promise<StoredLead[]> {
      const ghosts = (
        await findLeads({
          kind: 'CALL_CLICK',
          status: 'NEW',
          lastActivityAt: null,
        })
      ).filter((l) => isGhostLead(l, now));
      const expired = await Promise.all(
        ghosts.map((ghost) =>
          updateOne(ghost.id, (l) =>
            isGhostLead(l, now) ? statusPatch('lost', now) : undefined,
          ),
        ),
      );
      return expired.filter((lead) => lead !== undefined);
    },

    findIdleTopics(now: Date): Promise<StoredLead[]> {
      return findLeads({
        topicId: { not: null },
        topicClosed: false,
        topicActiveAt: null,
        createdAt: { lte: new Date(now.getTime() - TOPIC_IDLE_MS) },
      });
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
