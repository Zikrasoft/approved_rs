import { z } from 'zod';
import { format } from 'date-fns';
import { get, head, put, BlobPreconditionFailedError } from '@vercel/blob';
import type { LeadData } from './leadTypes';

const leadStatusSchema = z.enum(['new', 'in_progress', 'won', 'lost', 'postponed']);
export type LeadStatus = z.infer<typeof leadStatusSchema>;

const pendingPromptSchema = z.object({
  chatId: z.number().int(),
  messageId: z.number().int(),
  kind: z.enum(['deal_amount', 'edit_name', 'edit_contact', 'edit_comment', 'postpone']),
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
  createdAt: z.string(),
  // .catch(null) — this is transient UI state, not business data. A stale/legacy
  // shape here (e.g. a kind value retired by a later release) must not drop the
  // whole lead; it just clears the dangling prompt instead.
  pendingPrompt: pendingPromptSchema.nullable().default(null).catch(null),
  archived: z.boolean().default(false),
  pendingCommissionClaim: pendingCommissionClaimSchema.nullable().default(null),
  // Only meaningful while status is 'postponed' — ISO date (YYYY-MM-DD), no time.
  remindAt: z.string().nullable().default(null),
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
  // get()'s own blob.etag has been observed stuck on a stale weak value even
  // with useCache:false (production incident, 2026-09-03) — head() is what
  // Vercel's own docs use for ifMatch, and it isn't served from that cache.
  const etag = (await head(LEADS_PATH)).etag;
  if (!Array.isArray(parsedJson)) {
    // Guards against a truncated write leaving the blob non-array-shaped.
    console.error('[store] leads blob is not an array — treating as empty', { type: typeof parsedJson });
    return { leads: [], etag };
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
  return { leads, etag };
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

// Same as updateOne, but a no-op (returns undefined, leaves the record
// untouched) unless the lead is currently in requiredStatus — for
// transitions where a stale button on an old message must not apply on top
// of a lead that's moved on since.
async function updateOneIfStatus(
  id: number,
  requiredStatus: LeadStatus,
  apply: (lead: StoredLead) => StoredLead,
): Promise<StoredLead | undefined> {
  let updated: StoredLead | undefined;
  await updateLeads(leads => leads.map(l => {
    if (l.id !== id || l.status !== requiredStatus) return l;
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

const VISITOR_MERGE_WINDOW_MS = 60 * 60 * 1000;

function isPlaceholderContact(contact: string): boolean {
  return contact === '' || contact === '—';
}

// Shared by every "stick a note on the comment, don't lose what's already
// there" call site — insertOrMergeLead, postponeLead, the typed-date reply.
export function appendNote(comment: string | null | undefined, note: string): string {
  return comment ? `${comment}\n${note}` : note;
}

// Same visitor clicking Telegram, then WhatsApp, then the phone button in
// one sitting shouldn't create 3 separate leads/notifications — merge into
// whichever one is still 'new' instead. A real form submission upgrades a
// placeholder click-lead's name/contact once we actually have them.
export async function insertOrMergeLead(data: Omit<LeadData, 'id'>): Promise<{ lead: StoredLead; merged: boolean }> {
  let outcome!: { lead: StoredLead; merged: boolean };
  await updateLeads(leads => {
    const now = Date.now();
    const existing = data.visitorId
      ? leads.find(l =>
          l.visitorId === data.visitorId &&
          l.status === 'new' &&
          !l.archived &&
          now - new Date(l.createdAt).getTime() < VISITOR_MERGE_WINDOW_MS,
        )
      : undefined;

    if (!existing) {
      const id = leads.reduce((max, l) => Math.max(max, l.id), 0) + 1;
      const inserted = newStoredLead(data, id);
      outcome = { lead: inserted, merged: false };
      return [...leads, inserted];
    }

    const upgradeContact = isPlaceholderContact(existing.contact) && !isPlaceholderContact(data.contact);
    const merged: StoredLead = {
      ...existing,
      ...(upgradeContact ? { name: data.name, contact: data.contact, service: data.service, kind: data.kind } : {}),
      comment: appendNote(existing.comment, `Также пробовал: ${data.service}`),
    };
    outcome = { lead: merged, merged: true };
    return leads.map(l => (l.id === existing.id ? merged : l));
  });
  return outcome;
}

export function setTelegramMessage(id: number, chatId: number, messageId: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, telegramChatId: chatId, telegramMessageId: messageId }));
}

export function setStatus(id: number, status: LeadStatus): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, status, statusChangedAt: new Date().toISOString() }));
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

// Manual early return from 'postponed' — the scheduled reminder (getDuePostponed)
// does the same transition automatically once remindAt arrives. Guarded on
// status: a stale "▶️ Возобновить" left on an old DM message (this bot
// routinely has several live messages per lead) must not revert a lead that
// moved on (won/lost) via a different message in the meantime.
export function resumeLead(id: number): Promise<StoredLead | undefined> {
  return updateOneIfStatus(id, 'postponed', l => ({ ...l, status: 'in_progress', remindAt: null, statusChangedAt: new Date().toISOString() }));
}

// Direct id-based postpone for the button-driven pickers (quick preset,
// typed date) — no prompt correlation needed since the id is already known
// from the tapped button's callback_data. Guarded on status for the same
// stale-button reason as resumeLead. The comment note is appended inside
// this CAS-protected closure (not pre-built by the caller) so a concurrent
// edit to the comment can't be silently lost on a retry.
export function postponeLead(id: number, remindAt: string, note: string): Promise<StoredLead | undefined> {
  return updateOneIfStatus(id, 'in_progress', l => ({
    ...l, status: 'postponed', remindAt, statusChangedAt: new Date().toISOString(), comment: appendNote(l.comment, note),
  }));
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

// 'YYYY-MM-DD', server-local date — matches the format remindAt is stored in.
function todayISODate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function getDuePostponed(): Promise<StoredLead[]> {
  const today = todayISODate();
  const leads = await readLeads();
  return leads.filter(l => l.status === 'postponed' && !l.archived && l.remindAt != null && l.remindAt <= today);
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
