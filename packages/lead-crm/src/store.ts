import { z } from 'zod';
import { channelLabel } from './channelLabels.ts';
import { isClosed } from './schema.ts';
import type {
  CapturePrompt,
  Referrer,
  LeadInput,
  LeadStatus,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
import type { PromptKey } from './promptKey.ts';
import type { StoredLeadSchema } from './schema.ts';
import { storedRecordsSchema, type LeadStorage } from './storage/types.ts';
import { retryOnConflict } from './storage/retry.ts';
import { LEADS_PATH } from './quarantine.ts';
import { businessDay, DAY_MS } from './businessTime.ts';

export const VISITOR_MERGE_WINDOW_MS = 60 * 60 * 1000;

export const MAX_LIST_ROWS = 20;

export interface CaptureUpdate {
  note?: string;
  contact?: string;
  service?: string;
  locale?: string;
  referredBy?: Referrer;
  capturePrompt: CapturePrompt | null;
}

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

const digestMarkSchema = z.object({
  type: z.literal('digest'),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string(),
});
type DigestMark = z.infer<typeof digestMarkSchema>;

function lastActionAt(lead: StoredLead): number {
  return Math.max(
    Date.parse(lead.statusChangedAt),
    lead.lastActivityAt ? Date.parse(lead.lastActivityAt) : 0,
  );
}

interface StoreRecords {
  leads: StoredLead[];
  digests: DigestMark[];
}

function digestOf(leads: StoredLead[], now: Date): Digest {
  const today = businessDay(now);
  return {
    stale: leads.filter(
      (l) =>
        l.status === 'open' &&
        now.getTime() - lastActionAt(l) >= STALE_AFTER_MS,
    ),
    due: leads.filter(
      (l) =>
        l.status === 'postponed' && l.remindAt != null && l.remindAt <= today,
    ),
  };
}

export interface LeadStoreOptions {
  storage: LeadStorage;
  schema: StoredLeadSchema;
  quarantine?: (entries: unknown[]) => Promise<void>;
  beforeWrite?: () => Promise<void>;
}

const promptedAt =
  ({ chatId, messageId }: PromptKey) =>
  (lead: StoredLead) =>
    lead.pendingPrompt?.chatId === chatId &&
    lead.pendingPrompt?.messageId === messageId;

export function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

function isPhoneContact(contact: string): boolean {
  return contact.startsWith('+');
}

export const GHOST_LEAD_RETENTION_MS = DAY_MS;

function untouched(lead: StoredLead): boolean {
  return lead.status === 'open' && lead.lastActivityAt == null;
}

function isGhostLead(lead: StoredLead, now: Date): boolean {
  return (
    lead.kind === 'call_click' &&
    isPlaceholderContact(lead.contact) &&
    untouched(lead) &&
    now.getTime() - new Date(lead.createdAt).getTime() >=
      GHOST_LEAD_RETENTION_MS
  );
}

function newestOpen(
  leads: StoredLead[],
  brand: string,
  matches: (lead: StoredLead) => boolean,
): StoredLead | undefined {
  return leads
    .filter((l) => l.brand === brand && !isClosed(l) && matches(l))
    .sort((a, b) => a.id - b.id)
    .at(-1);
}

function supersede(leads: StoredLead[], landed: StoredLead): StoredLead[] {
  if (landed.telegramId == null) return leads;
  return leads.map((l) =>
    l.id !== landed.id &&
    l.brand === landed.brand &&
    l.telegramId === landed.telegramId &&
    l.capturePrompt
      ? { ...l, capturePrompt: null }
      : l,
  );
}

const MAX_STORED_COMMENT_LENGTH = 4000;

function triedLabel(data: LeadInput): string {
  if (data.services?.length) return data.services.join(', ');
  if (data.service) return data.service;
  return data.kind === 'call_click' && data.contactChannel
    ? channelLabel(data.contactChannel)
    : '';
}

export function appendNote(
  comment: string | null | undefined,
  note: string,
): string {
  const next = comment ? `${comment}\n${note}` : note;
  return next.slice(-MAX_STORED_COMMENT_LENGTH);
}

export function canPostpone(lead: StoredLead): boolean {
  return lead.status === 'open';
}

export function postponePatch(
  lead: StoredLead,
  remindAt: string,
  note: string,
): Partial<StoredLead> {
  return {
    ...statusPatch('postponed'),
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

export function resumePatch(): Partial<StoredLead> {
  return { ...statusPatch('open'), remindAt: null };
}

const retiredRecord = z.looseObject({
  type: z.enum(['draft', 'payout', 'settlement', 'summary', 'settle_prompt']),
});

const unreadableId = z.object({
  id: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER - 1),
});

function unreadableIdFloor(entries: unknown[]): number {
  return entries.reduce<number>((max, entry) => {
    const parsed = unreadableId.safeParse(entry);
    return parsed.success && parsed.data.id > max ? parsed.data.id : max;
  }, 0);
}

export function createLeadStore({
  storage,
  schema,
  quarantine,
  beforeWrite,
}: LeadStoreOptions) {
  function newStoredLead(data: LeadInput, id: number): StoredLead {
    const now = new Date().toISOString();
    return schema.parse({ ...data, id, statusChangedAt: now, createdAt: now });
  }

  async function readSnapshot(): Promise<
    StoreRecords & { unreadable: unknown[]; version: string | undefined }
  > {
    const { raw, version } = await storage.read();
    if (raw === undefined) {
      return { leads: [], digests: [], unreadable: [], version };
    }
    const records = storedRecordsSchema.safeParse(raw);
    if (!records.success) {
      console.error('[lead-crm] stored leads are not an array', {
        path: LEADS_PATH,
        type: typeof raw,
      });
      throw new Error(
        `[lead-crm] stored leads are ${typeof raw}, not an array — refusing to overwrite`,
      );
    }
    const leads: StoredLead[] = [];
    const digests: DigestMark[] = [];
    const unreadable: unknown[] = [];
    for (const entry of records.data) {
      if (retiredRecord.safeParse(entry).success) continue;
      const digest = digestMarkSchema.safeParse(entry);
      if (digest.success) {
        digests.push(digest.data);
        continue;
      }
      const parsed = schema.safeParse(entry);
      if (parsed.success) leads.push(parsed.data);
      else unreadable.push(entry);
    }
    return { leads, digests, unreadable, version };
  }

  async function updateRecords(
    mutate: (records: StoreRecords, idFloor: number) => Partial<StoreRecords>,
  ): Promise<StoreRecords> {
    const { next, unreadable } = await retryOnConflict(async () => {
      const { unreadable, version, ...current } = await readSnapshot();
      const mutated = {
        ...current,
        ...mutate(current, unreadableIdFloor(unreadable)),
      };
      const next: StoreRecords = {
        leads: mutated.leads.map((lead) => schema.parse(lead)),
        digests: mutated.digests.map((m) => digestMarkSchema.parse(m)),
      };
      if (JSON.stringify(next) === JSON.stringify(current))
        return { next, unreadable };
      await beforeWrite?.();
      await storage.write(
        [...next.leads, ...next.digests, ...unreadable],
        version,
      );
      return { next, unreadable };
    }, 'updateLeads: conflict retry limit exceeded');
    await copyToQuarantine(unreadable);
    return next;
  }

  async function updateLeads(
    mutate: (leads: StoredLead[], idFloor: number) => StoredLead[],
  ): Promise<StoredLead[]> {
    const { leads } = await updateRecords(({ leads }, idFloor) => ({
      leads: mutate(leads, idFloor),
    }));
    return leads;
  }

  async function readLeads(): Promise<StoredLead[]> {
    const { leads } = await readSnapshot();
    return leads;
  }

  async function getLead(id: number): Promise<StoredLead | undefined> {
    const leads = await readLeads();
    return leads.find((l) => l.id === id);
  }

  async function updateMatching(
    matches: (lead: StoredLead) => boolean,
    apply: (lead: StoredLead) => StoredLead,
  ): Promise<StoredLead | undefined> {
    let touchedId: number | undefined;
    const next = await updateLeads((leads) => {
      touchedId = undefined;
      return leads.map((l) => {
        if (!matches(l)) return l;
        touchedId = l.id;
        return apply(l);
      });
    });
    return touchedId == null ? undefined : next.find((l) => l.id === touchedId);
  }

  function updateOne(
    id: number,
    apply: (lead: StoredLead) => StoredLead,
  ): Promise<StoredLead | undefined> {
    return updateMatching((l) => l.id === id, apply);
  }

  function updateOneIfStatus(
    id: number,
    requiredStatus: LeadStatus,
    apply: (lead: StoredLead) => StoredLead,
  ): Promise<StoredLead | undefined> {
    return updateMatching(
      (l) => l.id === id && l.status === requiredStatus,
      apply,
    );
  }

  async function copyToQuarantine(entries: unknown[]): Promise<void> {
    if (entries.length === 0 || !quarantine) return;
    try {
      await quarantine(entries);
    } catch (error) {
      console.error('[lead-crm] could not copy the unreadable records', {
        count: entries.length,
        error,
      });
    }
  }

  function nextId(leads: StoredLead[], idFloor: number): number {
    return leads.reduce((max, l) => Math.max(max, l.id), idFloor) + 1;
  }

  return {
    updateLeads,
    readLeads,
    getLead,
    newStoredLead,

    async insertLead(data: LeadInput): Promise<StoredLead> {
      let inserted!: StoredLead;
      await updateLeads((leads, idFloor) => {
        inserted = newStoredLead(data, nextId(leads, idFloor));
        return [...leads, inserted];
      });
      return inserted;
    },

    async insertOrMergeLead(data: LeadInput): Promise<MergeOutcome> {
      let outcome!: MergeOutcome;
      await updateLeads((leads, idFloor) => {
        const now = Date.now();
        const existing = data.visitorId
          ? leads.find(
              (l) =>
                l.visitorId === data.visitorId &&
                l.brand === data.brand &&
                untouched(l) &&
                now - new Date(l.createdAt).getTime() <
                  VISITOR_MERGE_WINDOW_MS &&
                (data.telegramId == null || isPlaceholderContact(l.contact)),
            )
          : undefined;

        if (!existing) {
          const inserted = newStoredLead(data, nextId(leads, idFloor));
          outcome = { lead: inserted, merged: false, before: null };
          return supersede([...leads, inserted], inserted);
        }

        const upgradeContact =
          isPlaceholderContact(existing.contact) &&
          !isPlaceholderContact(data.contact);
        const botHandOff =
          (data.telegramId ?? existing.telegramId) != null &&
          data.contactChannel === existing.contactChannel;
        const tried = botHandOff ? '' : triedLabel(data);
        const clickedFirst =
          upgradeContact &&
          !botHandOff &&
          existing.kind === 'call_click' &&
          existing.contactChannel
            ? channelLabel(existing.contactChannel)
            : null;
        const merged: StoredLead = {
          ...existing,
          ...(upgradeContact
            ? {
                name: data.name,
                contact: data.contact,
                contactChannel: data.contactChannel ?? existing.contactChannel,
                service: data.service || existing.service,
                services: data.services?.length
                  ? data.services
                  : existing.services,
                kind: data.kind ?? existing.kind,
              }
            : {}),
          source_url: existing.source_url ?? data.source_url,
          telegramId: data.telegramId ?? existing.telegramId,
          referredBy: data.referredBy ?? existing.referredBy,
          capturePrompt: data.capturePrompt ?? existing.capturePrompt,
          visitorActiveAt:
            data.telegramId == null
              ? existing.visitorActiveAt
              : new Date(now).toISOString(),
          comment: appendNote(
            existing.comment,
            [
              clickedFirst ? `Сначала кликнул: ${clickedFirst}` : '',
              tried ? `Также пробовал: ${tried}` : '',
              data.comment?.trim(),
            ]
              .filter(Boolean)
              .join('\n'),
          ),
        };
        outcome = { lead: merged, merged: true, before: existing };
        return supersede(
          leads.map((l) => (l.id === existing.id ? merged : l)),
          merged,
        );
      });
      return outcome;
    },

    setTelegramMessage(
      id: number,
      chatId: number,
      messageId: number,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({
        ...l,
        telegramChatId: chatId,
        telegramMessageId: messageId,
      }));
    },

    setStatus(id: number, status: LeadStatus): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({ ...l, ...statusPatch(status) }));
    },

    addNote(id: number, note: string): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({
        ...l,
        comment: appendNote(l.comment, note),
        lastActivityAt: new Date().toISOString(),
      }));
    },

    touchLead(
      id: number,
      at: Date = new Date(),
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({ ...l, lastActivityAt: at.toISOString() }));
    },

    setPendingPrompt(
      id: number,
      prompt: PendingPrompt | null,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({ ...l, pendingPrompt: prompt }));
    },

    async findByPendingPrompt(key: PromptKey): Promise<StoredLead | undefined> {
      return (await readLeads()).find(promptedAt(key));
    },

    async findByCard({
      chatId,
      messageId,
    }: PromptKey): Promise<StoredLead | undefined> {
      const leads = await readLeads();
      return leads.find(
        (l) => l.telegramChatId === chatId && l.telegramMessageId === messageId,
      );
    },

    resolvePendingPrompt(
      key: PromptKey,
      apply: (lead: StoredLead) => Partial<StoredLead>,
    ): Promise<StoredLead | undefined> {
      return updateMatching(promptedAt(key), (l) => ({
        ...l,
        lastActivityAt: new Date().toISOString(),
        ...apply(l),
        pendingPrompt: null,
      }));
    },

    updateCapture(
      id: number,
      {
        note,
        contact,
        service,
        locale,
        referredBy,
        capturePrompt,
      }: CaptureUpdate,
    ): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({
        ...l,
        comment: note ? appendNote(l.comment, note) : l.comment,
        contact: contact ?? l.contact,
        ...(service ? { service, services: [service] } : {}),
        locale: locale ?? l.locale,
        referredBy: referredBy ?? l.referredBy,
        capturePrompt,
        visitorActiveAt: new Date().toISOString(),
      }));
    },

    async findOpenLeadByTelegramId(
      telegramId: number,
      brand: string,
    ): Promise<StoredLead | undefined> {
      return newestOpen(
        await readLeads(),
        brand,
        (l) => l.telegramId === telegramId,
      );
    },

    async findPhoneByTelegramId(
      telegramId: number,
      brand: string,
    ): Promise<string | undefined> {
      return (await readLeads())
        .filter(
          (l) =>
            l.brand === brand &&
            l.telegramId === telegramId &&
            isPhoneContact(l.contact),
        )
        .sort((a, b) => a.id - b.id)
        .at(-1)?.contact;
    },

    async findByCapturePrompt(
      chatId: number,
      brand: string,
    ): Promise<StoredLead | undefined> {
      return newestOpen(
        await readLeads(),
        brand,
        (l) => l.capturePrompt?.chatId === chatId,
      );
    },

    resumeLead(id: number): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, 'postponed', (l) => ({
        ...l,
        ...resumePatch(),
      }));
    },

    postponeLead(
      id: number,
      remindAt: string,
      note: string,
    ): Promise<StoredLead | undefined> {
      return updateMatching(
        (l) => l.id === id && canPostpone(l),
        (l) => ({ ...l, ...postponePatch(l, remindAt, note) }),
      );
    },

    async deleteLead(id: number): Promise<boolean> {
      let found = false;
      await updateLeads((leads) => {
        const next = leads.filter((l) => l.id !== id);
        found = next.length !== leads.length;
        return next;
      });
      return found;
    },

    async searchLeads(query: string, limit = 10): Promise<StoredLead[]> {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const leads = await readLeads();
      return leads
        .filter(
          (l) =>
            String(l.id) === q ||
            l.name.toLowerCase().includes(q) ||
            l.contact.toLowerCase().includes(q) ||
            (l.comment ?? '').toLowerCase().includes(q),
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, limit);
    },

    async claimDigest(now: Date): Promise<Digest | undefined> {
      const day = businessDay(now);
      let claimed: Digest | undefined;
      await updateRecords(({ leads, digests }) => {
        claimed = undefined;
        if (digests.some((d) => d.day === day)) return {};
        claimed = digestOf(leads, now);
        if (Object.values(claimed).every((list) => list.length === 0))
          return {};
        const mark = {
          type: 'digest' as const,
          day,
          createdAt: now.toISOString(),
        };
        return { digests: [mark] };
      });
      return claimed;
    },

    async releaseDigest(now: Date): Promise<void> {
      const day = businessDay(now);
      await updateRecords(({ digests }) => ({
        digests: digests.filter((d) => d.day !== day),
      }));
    },

    async expireGhostLeads(now: Date): Promise<StoredLead[]> {
      if (!(await readLeads()).some((l) => isGhostLead(l, now))) return [];
      let expiredIds = new Set<number>();
      const next = await updateLeads((leads) => {
        expiredIds = new Set(
          leads.filter((l) => isGhostLead(l, now)).map((l) => l.id),
        );
        return leads.map((l) =>
          expiredIds.has(l.id) ? { ...l, ...statusPatch('lost', now) } : l,
        );
      });
      return next.filter((l) => expiredIds.has(l.id));
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
