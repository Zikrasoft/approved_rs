import { z } from 'zod';
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import type { LeadData } from './leadTypes';

const leadStatusSchema = z.enum(['new', 'in_progress', 'won', 'lost']);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

const pendingPromptSchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
  kind: z.enum(['deal_amount', 'edit_name', 'edit_contact', 'edit_comment']),
});
export type PendingPrompt = z.infer<typeof pendingPromptSchema>;

// amount must be positive — mirrors the webhook's own parseAmount check.
const paymentSchema = z.object({
  amount: z.number().positive(),
  at: z.string(),
});
export type Payment = z.infer<typeof paymentSchema>;

const pendingCommissionClaimSchema = z.object({
  amount: z.number().positive(),
  claimedAt: z.string(),
});
export type PendingCommissionClaim = z.infer<typeof pendingCommissionClaimSchema>;

// Fields with .default() backfill old blob records on read; the rest have been required since day one.
const storedLeadSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  contact: z.string(),
  service: z.string(),
  contactChannel: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  visitorId: z.string().nullable().optional(),
  locale: z.enum(['ru', 'en', 'sr']),
  kind: z.enum(['lead', 'call_click']).optional(),
  status: leadStatusSchema.default('new'),
  dealAmount: z.number().nonnegative().nullable().default(null),
  commissionPercent: z.number().nonnegative().default(10),
  paidAmount: z.number().nonnegative().default(0),
  payments: z.array(paymentSchema).default(() => []),
  // No sign constraint — Telegram group/supergroup ids are negative.
  telegramChatId: z.number().int().nullable().default(null),
  telegramMessageId: z.number().int().nullable().default(null),
  statusChangedAt: z.string(),
  lastRemindedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  // .catch(null) — this is transient UI state, not business data. A stale/legacy
  // shape here (e.g. a kind value retired by a later release) must not drop the
  // whole lead; it just clears the dangling prompt instead.
  pendingPrompt: pendingPromptSchema.nullable().default(null).catch(null),
  archived: z.boolean().default(false),
  pendingCommissionClaim: pendingCommissionClaimSchema.nullable().default(null),
});
export type StoredLead = z.infer<typeof storedLeadSchema>;

const LEADS_PATH = 'data/leads.json';
const MAX_RETRIES = 6;
const PAID_EPSILON = 0.005;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Exponential, not flat — two writers retrying in lockstep (e.g. a bot edit
// racing a real website lead submission) stay desynced only if each round
// widens the window, not if every retry waits the same ~fixed amount.
function backoffDelay(attempt: number): number {
  const base = 25 * 2 ** attempt;
  return base + Math.random() * base;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function readLeadsRaw(): Promise<{ leads: StoredLead[]; etag: string | undefined }> {
  // useCache: false — feeds a conditional write, no reason to risk a stale etag.
  const result = await get(LEADS_PATH, { access: 'private', useCache: false });
  if (!result) return { leads: [], etag: undefined };
  const text = await new Response(result.stream).text();
  const parsedJson: unknown = JSON.parse(text);
  if (!Array.isArray(parsedJson)) {
    // Guards against a truncated write leaving the blob non-array-shaped.
    console.error('[store] leads blob is not an array — treating as empty', { type: typeof parsedJson });
    return { leads: [], etag: result.blob.etag };
  }
  // Per-record safeParse — one corrupted entry drops itself, not the rest.
  const leads = parsedJson.flatMap(entry => {
    const parsed = storedLeadSchema.safeParse(entry);
    if (!parsed.success) {
      console.error('[store] dropping a corrupt lead record on read', { entry, error: parsed.error.message });
      return [];
    }
    return [parsed.data];
  });
  return { leads, etag: result.blob.etag };
}

async function writeLeadsRaw(leads: StoredLead[], etag: string | undefined): Promise<void> {
  const options: Parameters<typeof put>[2] = {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json',
  };
  // Omitted only on the very first write (no blob yet, no etag to match).
  if (etag) options.ifMatch = etag;
  await put(LEADS_PATH, JSON.stringify(leads), options);
}

// CAS retry — a concurrent write's ifMatch conflict re-reads and re-applies.
export async function updateLeads(mutate: (leads: StoredLead[]) => StoredLead[]): Promise<StoredLead[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Jittered backoff before a retry — without it, two requests racing in
    // lockstep can keep re-colliding on every attempt instead of one winning.
    if (attempt > 0) await sleep(backoffDelay(attempt - 1));
    const { leads, etag } = await readLeadsRaw();
    const next = mutate(leads);
    // Validate before writing, not just on the next read — outside the
    // try/catch below since this is a programmer error, not a write conflict.
    next.forEach(lead => storedLeadSchema.parse(lead));
    try {
      await writeLeadsRaw(next, etag);
      return next;
    } catch (err) {
      if (err instanceof BlobPreconditionFailedError) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('updateLeads: conflict retry limit exceeded');
}

export async function readLeads(): Promise<StoredLead[]> {
  const { leads } = await readLeadsRaw();
  return leads;
}

export async function getLead(id: number): Promise<StoredLead | undefined> {
  const leads = await readLeads();
  return leads.find(l => l.id === id);
}

async function updateOne(id: number, apply: (lead: StoredLead) => StoredLead): Promise<StoredLead | undefined> {
  let updated: StoredLead | undefined;
  await updateLeads(leads => leads.map(l => {
    if (l.id !== id) return l;
    updated = apply(l);
    return updated;
  }));
  return updated;
}

// Defaults come from the schema — insertLead and notifyLead.ts's fallback both use this.
export function newStoredLead(data: Omit<LeadData, 'id'>, id: number): StoredLead {
  const now = new Date().toISOString();
  return storedLeadSchema.parse({ ...data, id, statusChangedAt: now, createdAt: now });
}

export async function insertLead(data: Omit<LeadData, 'id'>): Promise<StoredLead> {
  let inserted!: StoredLead;
  await updateLeads(leads => {
    const id = leads.reduce((max, l) => Math.max(max, l.id), 0) + 1;
    inserted = newStoredLead(data, id);
    return [...leads, inserted];
  });
  return inserted;
}

export function setTelegramMessage(id: number, chatId: number, messageId: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, telegramChatId: chatId, telegramMessageId: messageId }));
}

export function setStatus(id: number, status: LeadStatus): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, status, statusChangedAt: new Date().toISOString(), lastRemindedAt: null }));
}

export function setPendingPrompt(id: number, prompt: PendingPrompt | null): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, pendingPrompt: prompt }));
}

// Read-only lookup, used to know a prompt's kind before parsing the reply.
export async function findByPendingPrompt(chatId: number, messageId: number): Promise<StoredLead | undefined> {
  const leads = await readLeads();
  return leads.find(l => l.pendingPrompt?.chatId === chatId && l.pendingPrompt?.messageId === messageId);
}

// Atomic answer-a-prompt: find, apply patch, clear — duplicate deliveries find no match.
export async function resolvePendingPrompt(
  chatId: number,
  messageId: number,
  apply: (lead: StoredLead) => Partial<StoredLead>,
): Promise<StoredLead | undefined> {
  let resolved: StoredLead | undefined;
  await updateLeads(leads => leads.map(l => {
    if (l.pendingPrompt?.chatId !== chatId || l.pendingPrompt?.messageId !== messageId) return l;
    resolved = { ...l, ...apply(l), pendingPrompt: null };
    return resolved;
  }));
  return resolved;
}

export function archiveLead(id: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, archived: true }));
}

export function unarchiveLead(id: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, archived: false }));
}

// Permanent, unlike archiveLead — removes the record outright.
export async function deleteLead(id: number): Promise<boolean> {
  let found = false;
  await updateLeads(leads => {
    const next = leads.filter(l => l.id !== id);
    found = next.length !== leads.length;
    return next;
  });
  return found;
}

// Claiming means "I sent it all" — no separate amount prompt, always the full remaining balance.
export function claimFullCommission(id: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({
    ...l,
    pendingCommissionClaim: { amount: getCommission(l).remaining, claimedAt: new Date().toISOString() },
  }));
}

// Moves the claim into paidAmount/payments; returns undefined on a no-op.
export async function confirmCommissionPayment(id: number): Promise<StoredLead | undefined> {
  let acted = false;
  const updated = await updateOne(id, l => {
    acted = false; // reset each attempt — updateLeads may retry this closure on a write conflict
    if (!l.pendingCommissionClaim) return l;
    acted = true;
    const { amount } = l.pendingCommissionClaim;
    return {
      ...l,
      paidAmount: roundMoney(l.paidAmount + amount),
      payments: [...l.payments, { amount, at: new Date().toISOString() }],
      pendingCommissionClaim: null,
    };
  });
  return acted ? updated : undefined;
}

// Same undefined-on-no-op convention as confirmCommissionPayment.
export async function rejectCommissionPayment(id: number): Promise<StoredLead | undefined> {
  let acted = false;
  const updated = await updateOne(id, l => {
    acted = false; // reset each attempt — updateLeads may retry this closure on a write conflict
    if (!l.pendingCommissionClaim) return l;
    acted = true;
    return { ...l, pendingCommissionClaim: null };
  });
  return acted ? updated : undefined;
}

export async function searchLeads(query: string, limit = 10): Promise<StoredLead[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const leads = await readLeads();
  return leads
    .filter(l =>
      String(l.id) === q ||
      l.name.toLowerCase().includes(q) ||
      l.contact.toLowerCase().includes(q) ||
      (l.comment ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export async function getStaleLeads(days: number): Promise<StoredLead[]> {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const leads = await readLeads();
  return leads.filter(l =>
    l.status === 'in_progress' &&
    !l.archived &&
    new Date(l.statusChangedAt).getTime() < cutoff &&
    (!l.lastRemindedAt || new Date(l.lastRemindedAt).getTime() < new Date(l.statusChangedAt).getTime()));
}

export function markReminded(id: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, lastRemindedAt: new Date().toISOString() }));
}

export interface CommissionInfo {
  commission: number;
  remaining: number;
  isPaidOff: boolean;
}

// Single source for the commission/remaining/"paid off" formula.
export function getCommission(lead: Pick<StoredLead, 'dealAmount' | 'commissionPercent' | 'paidAmount'>): CommissionInfo {
  const commission = roundMoney(((lead.dealAmount ?? 0) * lead.commissionPercent) / 100);
  const remaining = roundMoney(commission - lead.paidAmount);
  return { commission, remaining, isPaidOff: remaining <= PAID_EPSILON };
}

export interface OwedRow {
  id: number;
  name: string;
  dealAmount: number;
  commissionAmount: number;
  paidAmount: number;
  remaining: number;
}

// Shared cap for every list-rendering surface (here and in telegram.ts).
export const MAX_LIST_ROWS = 20;

export async function getOwedSummary(): Promise<{ rows: OwedRow[]; total: number }> {
  const leads = await readLeads();
  const rows: OwedRow[] = leads
    .filter((l): l is StoredLead & { dealAmount: number } => l.status === 'won' && l.dealAmount != null && !l.archived)
    .map(l => {
      const { commission, remaining } = getCommission(l);
      return { id: l.id, name: l.name, dealAmount: l.dealAmount, commissionAmount: commission, paidAmount: l.paidAmount, remaining };
    })
    .filter(row => row.remaining > PAID_EPSILON)
    .sort((a, b) => (a.remaining === b.remaining ? a.id - b.id : b.remaining - a.remaining));
  const total = roundMoney(rows.reduce((sum, r) => sum + r.remaining, 0));
  return { rows: rows.slice(0, MAX_LIST_ROWS), total };
}
