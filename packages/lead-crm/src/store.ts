import { z } from 'zod';
import { format } from 'date-fns';
import { getCommission, roundMoney, PAID_EPSILON } from './money.ts';
import type {
  LeadInput,
  LeadStatus,
  PendingPrompt,
  StoredLead,
} from './schema.ts';
import type { StoredLeadSchema } from './schema.ts';
import { StorageConflictError, type LeadStorage } from './storage/types.ts';

const MAX_RETRIES = 6;
const VISITOR_MERGE_WINDOW_MS = 60 * 60 * 1000;

export const MAX_LIST_ROWS = 20;

export interface OwedRow {
  id: number;
  name: string;
  brand: string;
  dealAmount: number;
  commissionAmount: number;
  paidAmount: number;
  remaining: number;
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

function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

const MAX_STORED_COMMENT_LENGTH = 4000;

export function appendNote(
  comment: string | null | undefined,
  note: string,
): string {
  const next = comment ? `${comment}\n${note}` : note;
  return next.slice(-MAX_STORED_COMMENT_LENGTH);
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

export function createLeadStore({
  storage,
  schema,
  quarantine,
}: LeadStoreOptions) {
  function newStoredLead(data: LeadInput, id: number): StoredLead {
    const now = new Date().toISOString();
    return schema.parse({ ...data, id, statusChangedAt: now, createdAt: now });
  }

  async function readSnapshot(): Promise<{
    leads: StoredLead[];
    unreadable: unknown[];
    version: string | undefined;
  }> {
    const { raw, version } = await storage.read();
    if (raw === undefined) return { leads: [], unreadable: [], version };
    if (!Array.isArray(raw)) {
      throw new Error(
        `[lead-crm] stored leads are ${typeof raw}, not an array — refusing to overwrite`,
      );
    }
    const leads: StoredLead[] = [];
    const unreadable: unknown[] = [];
    for (const entry of raw) {
      const parsed = schema.safeParse(entry);
      if (parsed.success) leads.push(parsed.data);
      else unreadable.push(entry);
    }
    return { leads, unreadable, version };
  }

  async function updateLeads(
    mutate: (leads: StoredLead[], idFloor: number) => StoredLead[],
  ): Promise<StoredLead[]> {
    let lastErr = new StorageConflictError(
      'updateLeads: conflict retry limit exceeded',
    );
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(backoffDelay(attempt - 1));
      const { leads, unreadable, version } = await readSnapshot();
      const next = mutate(leads, unreadableIdFloor(unreadable));
      next.forEach((lead) => schema.parse(lead));
      await copyToQuarantine(unreadable);
      try {
        await storage.write([...next, ...unreadable], version);
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

  async function readLeads(): Promise<StoredLead[]> {
    const { leads } = await readSnapshot();
    return leads;
  }

  async function getLead(id: number): Promise<StoredLead | undefined> {
    const leads = await readLeads();
    return leads.find((l) => l.id === id);
  }

  async function updateOne(
    id: number,
    apply: (lead: StoredLead) => StoredLead,
  ): Promise<StoredLead | undefined> {
    let updated: StoredLead | undefined;
    await updateLeads((leads) =>
      leads.map((l) => {
        if (l.id !== id) return l;
        updated = apply(l);
        return updated;
      }),
    );
    return updated;
  }

  async function updateOneIfStatus(
    id: number,
    requiredStatus: LeadStatus,
    apply: (lead: StoredLead) => StoredLead,
  ): Promise<StoredLead | undefined> {
    let updated: StoredLead | undefined;
    await updateLeads((leads) =>
      leads.map((l) => {
        if (l.id !== id || l.status !== requiredStatus) return l;
        updated = apply(l);
        return updated;
      }),
    );
    return updated;
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

  async function settleCommissionClaim(
    id: number,
    apply: (lead: StoredLead, amount: number) => StoredLead,
  ): Promise<StoredLead | undefined> {
    let acted = false;
    const updated = await updateOne(id, (l) => {
      acted = false;
      if (!l.pendingCommissionClaim) return l;
      acted = true;
      return apply(l, l.pendingCommissionClaim.amount);
    });
    return acted ? updated : undefined;
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

    async insertOrMergeLead(
      data: LeadInput,
    ): Promise<{ lead: StoredLead; merged: boolean }> {
      let outcome!: { lead: StoredLead; merged: boolean };
      await updateLeads((leads, idFloor) => {
        const now = Date.now();
        const existing = data.visitorId
          ? leads.find(
              (l) =>
                l.visitorId === data.visitorId &&
                l.brand === data.brand &&
                l.status === 'new' &&
                !l.archived &&
                now - new Date(l.createdAt).getTime() < VISITOR_MERGE_WINDOW_MS,
            )
          : undefined;

        if (!existing) {
          const inserted = newStoredLead(data, nextId(leads, idFloor));
          outcome = { lead: inserted, merged: false };
          return [...leads, inserted];
        }

        const upgradeContact =
          isPlaceholderContact(existing.contact) &&
          !isPlaceholderContact(data.contact);
        const triedLabel = data.services?.length
          ? data.services.join(', ')
          : data.service;
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
                kind: data.kind,
              }
            : {}),
          comment: appendNote(
            existing.comment,
            [
              triedLabel ? `Также пробовал: ${triedLabel}` : '',
              data.comment?.trim(),
            ]
              .filter(Boolean)
              .join('\n'),
          ),
        };
        outcome = { lead: merged, merged: true };
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
      return updateOne(id, (l) => ({
        ...l,
        status,
        statusChangedAt: new Date().toISOString(),
      }));
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

    async resolvePendingPrompt(
      chatId: number,
      messageId: number,
      apply: (lead: StoredLead) => Partial<StoredLead>,
    ): Promise<StoredLead | undefined> {
      let resolved: StoredLead | undefined;
      await updateLeads((leads) =>
        leads.map((l) => {
          if (
            l.pendingPrompt?.chatId !== chatId ||
            l.pendingPrompt?.messageId !== messageId
          )
            return l;
          resolved = { ...l, ...apply(l), pendingPrompt: null };
          return resolved;
        }),
      );
      return resolved;
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
        status: 'in_progress',
        remindAt: null,
        statusChangedAt: new Date().toISOString(),
      }));
    },

    postponeLead(
      id: number,
      remindAt: string,
      note: string,
    ): Promise<StoredLead | undefined> {
      return updateOneIfStatus(id, 'in_progress', (l) => ({
        ...l,
        status: 'postponed',
        remindAt,
        statusChangedAt: new Date().toISOString(),
        comment: appendNote(l.comment, note),
      }));
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

    claimFullCommission(id: number): Promise<StoredLead | undefined> {
      return updateOne(id, (l) => ({
        ...l,
        pendingCommissionClaim: {
          amount: getCommission(l).remaining,
          claimedAt: new Date().toISOString(),
        },
      }));
    },

    confirmCommissionPayment(id: number): Promise<StoredLead | undefined> {
      return settleCommissionClaim(id, (l, amount) => ({
        ...l,
        paidAmount: roundMoney(l.paidAmount + amount),
        payments: [...l.payments, { amount, at: new Date().toISOString() }],
        pendingCommissionClaim: null,
      }));
    },

    rejectCommissionPayment(id: number): Promise<StoredLead | undefined> {
      return settleCommissionClaim(id, (l) => ({
        ...l,
        pendingCommissionClaim: null,
      }));
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

    async getOwedSummary(): Promise<{ rows: OwedRow[]; total: number }> {
      const leads = await readLeads();
      const rows: OwedRow[] = leads
        .filter(
          (l): l is StoredLead & { dealAmount: number } =>
            l.status === 'won' && l.dealAmount != null && !l.archived,
        )
        .map((l) => {
          const { commission, remaining } = getCommission(l);
          return {
            id: l.id,
            name: l.name,
            brand: l.brand,
            dealAmount: l.dealAmount,
            commissionAmount: commission,
            paidAmount: l.paidAmount,
            remaining,
          };
        })
        .filter((row) => row.remaining > PAID_EPSILON)
        .sort((a, b) =>
          a.remaining === b.remaining ? a.id - b.id : b.remaining - a.remaining,
        );
      const total = roundMoney(rows.reduce((sum, r) => sum + r.remaining, 0));
      return { rows: rows.slice(0, MAX_LIST_ROWS), total };
    },
  };
}

export type LeadStore = ReturnType<typeof createLeadStore>;
