import { z } from 'zod';
import { format } from 'date-fns';
import { appendIncome } from './money.ts';
import { channelLabel } from './channelLabels.ts';
import { postponableStatus } from './schema.ts';
import type {
  CapturePrompt,
  Referrer,
  LeadInput,
  LeadStatus,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
import type { StoredLeadSchema } from './schema.ts';
import {
  StorageConflictError,
  storedRecordsSchema,
  type LeadStorage,
} from './storage/types.ts';
import { LEADS_PATH } from './quarantine.ts';
import {
  correction,
  draftSchema,
  ledgerBalance,
  ledgerRecordSchema,
  newSettlement,
  nextLedgerId,
  payoutSchema,
  settlementSchema,
  withMigratedIncomes,
  type Draft,
  type DraftPrompt,
  type Ledger,
  type LedgerAuthor,
  type Payout,
  type PayoutCorrection,
  type RecordPrompt,
  type Settlement,
} from './ledger.ts';

const MAX_RETRIES = 6;
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

export interface DraftInput {
  amount: number;
  by: LedgerAuthor;
  note: string;
  brand: string | null;
  leadId: number | null;
  matchPending: boolean;
}

export type DraftPatch = Partial<
  Pick<Draft, 'amount' | 'leadId' | 'matchPending' | 'pendingPrompt'>
>;

export interface PastLeadHints {
  name: string | null;
  phone: string | null;
}

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface StoreRecords {
  leads: StoredLead[];
  ledger: Ledger;
  drafts: Draft[];
}

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replaceAll('ё', 'е')
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

const phoneDigits = (value: string) => value.replace(/\D/g, '');

const MIN_PHONE_DIGITS = 6;
const PHONE_TAIL_DIGITS = 9;

function pastLeadMatchers({
  name,
  phone,
}: PastLeadHints): ((lead: StoredLead) => boolean)[] {
  const tail = phoneDigits(phone ?? '').slice(-PHONE_TAIL_DIGITS);
  const wanted = nameTokens(name ?? '');
  return [
    (lead) =>
      tail.length >= MIN_PHONE_DIGITS &&
      phoneDigits(lead.contact).endsWith(tail),
    (lead) => {
      const tokens = nameTokens(lead.name);
      return wanted.length > 0 && wanted.every((t) => tokens.includes(t));
    },
  ];
}

export interface LeadStoreOptions {
  storage: LeadStorage;
  schema: StoredLeadSchema;
  quarantine?: (entries: unknown[]) => Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  const base = 25 * 2 ** attempt;
  return base + Math.random() * base;
}

function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

function isPhoneContact(contact: string): boolean {
  return contact.startsWith('+');
}

export const GHOST_LEAD_RETENTION_MS = 24 * 60 * 60 * 1000;

function isGhostLead(lead: StoredLead, now: Date): boolean {
  return (
    lead.kind === 'call_click' &&
    isPlaceholderContact(lead.contact) &&
    lead.status === 'new' &&
    !lead.archived &&
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
    .filter(
      (l) =>
        l.brand === brand &&
        !l.archived &&
        l.status !== 'won' &&
        l.status !== 'lost' &&
        matches(l),
    )
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
  return postponableStatus(lead.status) !== null;
}

export function postponePatch(
  lead: StoredLead,
  remindAt: string,
  note: string,
): Partial<StoredLead> {
  return {
    ...statusPatch('postponed'),
    postponedFrom: postponableStatus(lead.status),
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

export function resumePatch(lead: StoredLead): Partial<StoredLead> {
  return {
    ...statusPatch(lead.postponedFrom ?? 'in_progress'),
    postponedFrom: null,
    remindAt: null,
  };
}

export function wonPatch(
  lead: StoredLead,
  amount: number,
): Partial<StoredLead> {
  return {
    ...statusPatch('won'),
    incomes: amount > 0 ? appendIncome(lead.incomes, amount) : lead.incomes,
  };
}

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
  prompt: RecordPrompt | DraftPrompt | null,
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
  const added = payoutSchema.parse({
    type: 'payout',
    id: nextLedgerId(ledger.payouts),
    amount,
    note,
    createdAt: new Date().toISOString(),
    createdBy: by,
    leadId,
    brand: brand ?? lead?.brand ?? null,
  });
  return {
    added,
    records: {
      leads: leads.map((l) =>
        l === lead && l.status === 'lost' ? { ...l, ...statusPatch('won') } : l,
      ),
      ledger: { ...ledger, payouts: [...ledger.payouts, added] },
    },
  };
}

export function createLeadStore({
  storage,
  schema,
  quarantine,
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
        drafts: [],
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
    const drafts: Draft[] = [];
    const unreadable: unknown[] = [];
    for (const entry of records.data) {
      const record = ledgerRecordSchema.safeParse(entry);
      if (record.success) {
        if (record.data.type === 'payout') ledger.payouts.push(record.data);
        else if (record.data.type === 'settlement')
          ledger.settlements.push(record.data);
        else drafts.push(record.data);
        continue;
      }
      const parsed = schema.safeParse(entry);
      if (parsed.success) leads.push(parsed.data);
      else unreadable.push(entry);
    }
    return {
      leads,
      ledger: withMigratedIncomes(leads, ledger),
      drafts,
      unreadable,
      version,
    };
  }

  async function updateRecords(
    mutate: (records: StoreRecords, idFloor: number) => Partial<StoreRecords>,
  ): Promise<StoreRecords> {
    let lastErr = new StorageConflictError(
      'updateLeads: conflict retry limit exceeded',
    );
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(backoffDelay(attempt - 1));
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
        drafts: mutated.drafts.map((d) => draftSchema.parse(d)),
      };
      await copyToQuarantine(unreadable);
      try {
        await storage.write(
          [
            ...next.leads,
            ...next.ledger.payouts,
            ...next.ledger.settlements,
            ...next.drafts,
            ...unreadable,
          ],
          version,
        );
        return next;
      } catch (err) {
        if (err instanceof StorageConflictError) {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
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
      await updateRecords(({ ledger }) => {
        outcome = correction(ledger, id, amount, by);
        if (!outcome.ok) return {};
        const { payout } = outcome;
        return {
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

    async findPastLead(hints: PastLeadHints): Promise<StoredLead | undefined> {
      const newestFirst = (await readLeads()).sort((a, b) => b.id - a.id);
      for (const matches of pastLeadMatchers(hints)) {
        const lead = newestFirst.find(matches);
        if (lead) return lead;
      }
      return undefined;
    },

    async addDraft(input: DraftInput): Promise<Draft> {
      let added!: Draft;
      await updateRecords(({ drafts }) => {
        const now = Date.now();
        added = draftSchema.parse({
          ...input,
          type: 'draft',
          id: Math.max(now, nextLedgerId(drafts)),
          createdAt: new Date(now).toISOString(),
          createdBy: input.by,
          pendingPrompt: null,
        });
        const fresh = drafts.filter(
          (d) => now - new Date(d.createdAt).getTime() < DRAFT_TTL_MS,
        );
        return { drafts: [...fresh, added] };
      });
      return added;
    },

    async getDraft(id: number): Promise<Draft | undefined> {
      const { drafts } = await readSnapshot();
      return drafts.find((d) => d.id === id);
    },

    async findDraftByPrompt(
      chatId: number,
      messageId: number,
    ): Promise<Draft | undefined> {
      const { drafts } = await readSnapshot();
      return drafts.find((d) => promptIs(d.pendingPrompt, chatId, messageId));
    },

    async updateDraft(
      id: number,
      patch: DraftPatch,
    ): Promise<Draft | undefined> {
      let touched: Draft | undefined;
      await updateRecords(({ drafts }) => {
        touched = undefined;
        return {
          drafts: drafts.map((d) => {
            if (d.id !== id) return d;
            touched = { ...d, ...patch };
            return touched;
          }),
        };
      });
      return touched;
    },

    async discardDraft(id: number): Promise<boolean> {
      let found = false;
      await updateRecords(({ drafts }) => {
        found = drafts.some((d) => d.id === id);
        return { drafts: drafts.filter((d) => d.id !== id) };
      });
      return found;
    },

    async confirmDraft(id: number): Promise<Payout | undefined> {
      let added: Payout | undefined;
      await updateRecords((records) => {
        added = undefined;
        const draft = records.drafts.find((d) => d.id === id);
        if (!draft) return {};
        const leadId = records.leads.some((l) => l.id === draft.leadId)
          ? draft.leadId
          : null;
        const outcome = withPayout(records, {
          amount: draft.amount,
          by: draft.createdBy,
          note: draft.note,
          leadId,
          brand: leadId == null ? draft.brand : null,
        });
        added = outcome.added;
        return {
          ...outcome.records,
          drafts: records.drafts.filter((d) => d.id !== id),
        };
      });
      return added;
    },

    async addSettlement(amount: number): Promise<Settlement> {
      let added!: Settlement;
      await updateRecords(({ ledger }) => {
        added = newSettlement(ledger, amount);
        return {
          ledger: { ...ledger, settlements: [...ledger.settlements, added] },
        };
      });
      return added;
    },

    async settleBalance(balance: number): Promise<Settlement | undefined> {
      let added: Settlement | undefined;
      await updateRecords(({ leads, ledger }) => {
        added = undefined;
        if (balance <= 0 || ledgerBalance(ledger) !== balance) {
          return { leads, ledger };
        }
        added = newSettlement(ledger, balance);
        return {
          leads,
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
                l.status === 'new' &&
                !l.archived &&
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
        (l) => ({ ...l, ...apply(l), pendingPrompt: null }),
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

    archiveLead(id: number): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({ ...l, archived: true }));
    },

    unarchiveLead(id: number): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({ ...l, archived: false }));
    },

    resumeLead(id: number): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, 'postponed', (l) => ({
        ...l,
        ...resumePatch(l),
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

    async getDuePostponed(): Promise<StoredLead[]> {
      const today = todayISODate();
      const leads = await readLeads();
      return leads.filter(
        (l) =>
          l.status === 'postponed' &&
          !l.archived &&
          l.remindAt != null &&
          l.remindAt <= today,
      );
    },

    async expireGhostLeads(now: Date): Promise<StoredLead[]> {
      const statusChangedAt = now.toISOString();
      const expired = (l: StoredLead) =>
        l.archived &&
        l.status === 'lost' &&
        l.statusChangedAt === statusChangedAt;
      if (!(await readLeads()).some((l) => isGhostLead(l, now))) return [];
      const next = await updateLeads((leads) =>
        leads.map((l) =>
          isGhostLead(l, now)
            ? { ...l, ...statusPatch('lost', now), archived: true }
            : l,
        ),
      );
      return next.filter(expired);
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
