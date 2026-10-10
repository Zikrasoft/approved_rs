import { z } from 'zod';
import { format } from 'date-fns';
import { toCents } from './money.ts';
import { LEDGER_TIME_ZONE } from './ledgerStore.ts';
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
import type { StoredLeadSchema } from './schema.ts';
import { storedRecordsSchema, type LeadStorage } from './storage/types.ts';
import { retryOnConflict } from './storage/retry.ts';
import { LEADS_PATH } from './quarantine.ts';
import {
  correction,
  digestMarkSchema,
  ledgerBalance,
  ledgerRecordSchema,
  newSettlement,
  nextLedgerId,
  payoutSchema,
  settlePromptSchema,
  settlementSchema,
  summaryMarkSchema,
  type DigestMark,
  type Ledger,
  type LedgerAuthor,
  type Payout,
  type PayoutCorrection,
  type RecordPrompt,
  type SettlePrompt,
  type Settlement,
  type SummaryMark,
} from './ledger.ts';

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

export interface PayoutInput {
  amount: number;
  by: LedgerAuthor;
  note?: string;
  leadId?: number | null;
  brand?: string | null;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = WEEK_MS;

export interface Digest {
  stale: StoredLead[];
  unpaid: StoredLead[];
  due: StoredLead[];
}

function lastActionAt(lead: StoredLead): number {
  return Math.max(
    Date.parse(lead.statusChangedAt),
    lead.lastActivityAt ? Date.parse(lead.lastActivityAt) : 0,
  );
}

interface StoreRecords {
  leads: StoredLead[];
  ledger: Ledger;
  summaries: SummaryMark[];
  digests: DigestMark[];
  settlePrompts: SettlePrompt[];
}

export interface MonthlySummary {
  month: string;
  since: string | null;
  balance: number;
  payouts: Payout[];
  leads: StoredLead[];
}

export const SUMMARY_TIME_ZONE = LEDGER_TIME_ZONE;

function summaryMonth(now: Date): string | null {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: SUMMARY_TIME_ZONE,
  })
    .format(now)
    .split('-');
  return day === '01' ? `${year}-${month}` : null;
}

const digestDay = (now: Date) => format(now, 'yyyy-MM-dd');

function digestOf({ leads, ledger }: StoreRecords, now: Date): Digest {
  const today = digestDay(now);
  const paid = new Set(ledger.payouts.map((p) => p.leadId));
  return {
    stale: leads.filter(
      (l) =>
        l.status === 'open' &&
        now.getTime() - lastActionAt(l) >= STALE_AFTER_MS,
    ),
    unpaid: leads.filter((l) => l.status === 'won' && !paid.has(l.id)),
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

export function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

function isPhoneContact(contact: string): boolean {
  return contact.startsWith('+');
}

export const GHOST_LEAD_RETENTION_MS = 24 * 60 * 60 * 1000;

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

const retiredDraft = z.looseObject({ type: z.literal('draft') });

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

function promptIs(
  prompt: RecordPrompt | null,
  chatId: number,
  messageId: number,
): boolean {
  return prompt?.chatId === chatId && prompt.messageId === messageId;
}

function withPayout(
  { leads, ledger }: StoreRecords,
  { amount, by, note = '', leadId = null, brand = null }: PayoutInput,
): { records: Partial<StoreRecords>; added?: Payout } {
  const lead = leads.find((l) => l.id === leadId);
  if (leadId != null && !lead) return { records: {} };
  const now = new Date();
  const added = payoutSchema.parse({
    type: 'payout',
    id: nextLedgerId(ledger.payouts),
    amount,
    note,
    createdAt: now.toISOString(),
    createdBy: by,
    leadId,
    brand: brand ?? lead?.brand ?? null,
  });
  return {
    added,
    records: {
      leads: leads.map((l) =>
        l === lead
          ? {
              ...l,
              ...(l.status === 'lost' ? statusPatch('won', now) : {}),
              lastActivityAt: now.toISOString(),
            }
          : l,
      ),
      ledger: { ...ledger, payouts: [...ledger.payouts, added] },
    },
  };
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
      return {
        leads: [],
        ledger: { payouts: [], settlements: [] },
        summaries: [],
        digests: [],
        settlePrompts: [],
        unreadable: [],
        version,
      };
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
    const ledger: Ledger = { payouts: [], settlements: [] };
    const summaries: SummaryMark[] = [];
    const digests: DigestMark[] = [];
    const settlePrompts: SettlePrompt[] = [];
    const unreadable: unknown[] = [];
    for (const entry of records.data) {
      if (retiredDraft.safeParse(entry).success) continue;
      const record = ledgerRecordSchema.safeParse(entry);
      if (record.success) {
        if (record.data.type === 'payout') ledger.payouts.push(record.data);
        else if (record.data.type === 'settlement')
          ledger.settlements.push(record.data);
        else if (record.data.type === 'digest') digests.push(record.data);
        else if (record.data.type === 'settle_prompt')
          settlePrompts.push(record.data);
        else summaries.push(record.data);
        continue;
      }
      const parsed = schema.safeParse(entry);
      if (parsed.success) leads.push(parsed.data);
      else unreadable.push(entry);
    }
    return {
      leads,
      ledger,
      summaries,
      digests,
      settlePrompts,
      unreadable,
      version,
    };
  }

  async function updateRecords(
    mutate: (records: StoreRecords, idFloor: number) => Partial<StoreRecords>,
  ): Promise<StoreRecords> {
    return retryOnConflict(async () => {
      const { unreadable, version, ...current } = await readSnapshot();
      const mutated = {
        ...current,
        ...mutate(current, unreadableIdFloor(unreadable)),
      };
      const next: StoreRecords = {
        leads: mutated.leads.map((lead) => schema.parse(lead)),
        ledger: {
          payouts: mutated.ledger.payouts.map((p) => payoutSchema.parse(p)),
          settlements: mutated.ledger.settlements.map((s) =>
            settlementSchema.parse(s),
          ),
        },
        summaries: mutated.summaries.map((m) => summaryMarkSchema.parse(m)),
        digests: mutated.digests.map((m) => digestMarkSchema.parse(m)),
        settlePrompts: mutated.settlePrompts.map((p) =>
          settlePromptSchema.parse(p),
        ),
      };
      await beforeWrite?.();
      await copyToQuarantine(unreadable);
      await storage.write(
        [
          ...next.leads,
          ...next.ledger.payouts,
          ...next.ledger.settlements,
          ...next.summaries,
          ...next.digests,
          ...next.settlePrompts,
          ...unreadable,
        ],
        version,
      );
      return next;
    }, 'updateLeads: conflict retry limit exceeded');
  }

  async function updateLeads(
    mutate: (leads: StoredLead[], idFloor: number) => StoredLead[],
  ): Promise<StoredLead[]> {
    const { leads } = await updateRecords(({ leads }, idFloor) => ({
      leads: mutate(leads, idFloor),
    }));
    return leads;
  }

  async function readLedger(): Promise<Ledger> {
    const { ledger } = await readSnapshot();
    return ledger;
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
    readLedger,

    async getBalance(): Promise<number> {
      return ledgerBalance(await readLedger());
    },

    async listPayouts(leadId?: number): Promise<Payout[]> {
      const { payouts } = await readLedger();
      return leadId == null
        ? payouts
        : payouts.filter((p) => p.leadId === leadId);
    },

    async addPayout(input: PayoutInput): Promise<Payout | undefined> {
      let added: Payout | undefined;
      await updateRecords((records) => {
        const outcome = withPayout(records, input);
        added = outcome.added;
        return outcome.records;
      });
      return added;
    },

    async correctPayout(
      id: number,
      amount: number,
      by: LedgerAuthor,
    ): Promise<PayoutCorrection> {
      let outcome!: PayoutCorrection;
      await updateRecords(({ leads, ledger }) => {
        outcome = correction(ledger, id, amount, by);
        if (!outcome.ok) return {};
        const { payout } = outcome;
        return {
          leads: leads.map((l) =>
            l.id === payout.leadId
              ? { ...l, lastActivityAt: new Date().toISOString() }
              : l,
          ),
          ledger: {
            ...ledger,
            payouts: ledger.payouts.map((p) => (p.id === id ? payout : p)),
          },
        };
      });
      return outcome;
    },

    async setPayoutPrompt(
      id: number,
      prompt: RecordPrompt | null,
    ): Promise<Payout | undefined> {
      let touched: Payout | undefined;
      await updateRecords(({ ledger }) => {
        touched = undefined;
        return {
          ledger: {
            ...ledger,
            payouts: ledger.payouts.map((p) => {
              if (p.id !== id) return p;
              touched = { ...p, pendingPrompt: prompt };
              return touched;
            }),
          },
        };
      });
      return touched;
    },

    async findPayoutByPrompt(
      chatId: number,
      messageId: number,
    ): Promise<Payout | undefined> {
      const { payouts } = await readLedger();
      return payouts.find((p) => promptIs(p.pendingPrompt, chatId, messageId));
    },

    async addSettlePrompt(prompt: RecordPrompt): Promise<void> {
      await updateRecords(({ settlePrompts }) => {
        const now = Date.now();
        const fresh = settlePrompts.filter(
          (p) => now - new Date(p.createdAt).getTime() < WEEK_MS,
        );
        const added = {
          type: 'settle_prompt' as const,
          ...prompt,
          createdAt: new Date(now).toISOString(),
        };
        return { settlePrompts: [...fresh, added] };
      });
    },

    async findSettlePrompt(
      chatId: number,
      messageId: number,
    ): Promise<boolean> {
      const { settlePrompts } = await readSnapshot();
      return settlePrompts.some((p) => promptIs(p, chatId, messageId));
    },

    async addSettlement(
      amount: number,
      answered?: RecordPrompt,
    ): Promise<Settlement> {
      let added!: Settlement;
      await updateRecords(({ ledger, settlePrompts }) => {
        added = newSettlement(ledger, amount);
        return {
          ledger: { ...ledger, settlements: [...ledger.settlements, added] },
          settlePrompts: settlePrompts.filter(
            (p) =>
              !answered || !promptIs(p, answered.chatId, answered.messageId),
          ),
        };
      });
      return added;
    },

    async settleBalance(balance: number): Promise<Settlement | undefined> {
      let added: Settlement | undefined;
      await updateRecords(({ ledger }) => {
        added = undefined;
        const owed = ledgerBalance(ledger);
        if (owed <= 0 || toCents(owed) !== toCents(balance)) return {};
        added = newSettlement(ledger, owed);
        return {
          ledger: { ...ledger, settlements: [...ledger.settlements, added] },
        };
      });
      return added;
    },

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
          return [...leads, inserted];
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
        return leads.map((l) => (l.id === existing.id ? merged : l));
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

    async findByPendingPrompt(
      chatId: number,
      messageId: number,
    ): Promise<StoredLead | undefined> {
      const leads = await readLeads();
      return leads.find(
        (l) =>
          l.pendingPrompt?.chatId === chatId &&
          l.pendingPrompt?.messageId === messageId,
      );
    },

    async findByCard(
      chatId: number,
      messageId: number,
    ): Promise<StoredLead | undefined> {
      const leads = await readLeads();
      return leads.find(
        (l) => l.telegramChatId === chatId && l.telegramMessageId === messageId,
      );
    },

    resolvePendingPrompt(
      chatId: number,
      messageId: number,
      apply: (lead: StoredLead) => Partial<StoredLead>,
    ): Promise<StoredLead | undefined> {
      return updateMatching(
        (l) =>
          l.pendingPrompt?.chatId === chatId &&
          l.pendingPrompt?.messageId === messageId,
        (l) => ({
          ...l,
          lastActivityAt: new Date().toISOString(),
          ...apply(l),
          pendingPrompt: null,
        }),
      );
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

    async claimMonthlySummary(now: Date): Promise<MonthlySummary | undefined> {
      const month = summaryMonth(now);
      if (!month) return undefined;
      let claimed: MonthlySummary | undefined;
      await updateRecords(({ leads, ledger, summaries }) => {
        claimed = undefined;
        if (summaries.some((m) => m.month === month)) return {};
        const since =
          summaries
            .map((m) => m.createdAt)
            .sort()
            .at(-1) ?? null;
        claimed = {
          month,
          since,
          balance: ledgerBalance(ledger),
          payouts: ledger.payouts.filter(
            (p) => since == null || p.createdAt > since,
          ),
          leads: leads.filter((l) => !isClosed(l)),
        };
        const mark = {
          type: 'summary' as const,
          id: nextLedgerId(summaries),
          month,
          createdAt: now.toISOString(),
        };
        return { summaries: [...summaries, mark] };
      });
      return claimed;
    },

    async releaseMonthlySummary(month: string): Promise<void> {
      await updateRecords(({ summaries }) => ({
        summaries: summaries.filter((m) => m.month !== month),
      }));
    },

    async claimDigest(now: Date): Promise<Digest | undefined> {
      const day = digestDay(now);
      let claimed: Digest | undefined;
      await updateRecords((records) => {
        claimed = undefined;
        if (records.digests.some((d) => d.day === day)) return {};
        claimed = digestOf(records, now);
        if (Object.values(claimed).every((leads) => leads.length === 0))
          return {};
        const mark = {
          type: 'digest' as const,
          id: nextLedgerId(records.digests),
          day,
          createdAt: now.toISOString(),
        };
        return { digests: [mark] };
      });
      return claimed;
    },

    async releaseDigest(now: Date): Promise<void> {
      const day = digestDay(now);
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
