import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import type { LeadData } from './leadTypes';

export type LeadStatus = 'new' | 'in_progress' | 'won' | 'lost';

export interface PendingPrompt {
  chatId: number;
  messageId: number;
  kind: 'deal_amount' | 'edit_name' | 'edit_contact' | 'edit_comment' | 'commission_claim';
}

export interface Payment {
  amount: number;
  at: string;
}

export interface PendingCommissionClaim {
  amount: number;
  claimedAt: string;
}

// Everything the bot's menus/detail view need, on top of the raw form
// submission (LeadData). One JSON blob holds the full array — see
// updateLeads below for how concurrent writes stay safe without a real DB.
export interface StoredLead extends LeadData {
  status: LeadStatus;
  dealAmount: number | null;
  commissionPercent: number;
  paidAmount: number;
  payments: Payment[];
  telegramChatId: number | null;
  telegramMessageId: number | null;
  statusChangedAt: string;
  lastRemindedAt: string | null;
  createdAt: string;
  pendingPrompt: PendingPrompt | null;
  archived: boolean;
  customerPaidAt: string | null;
  pendingCommissionClaim: PendingCommissionClaim | null;
}

const LEADS_PATH = 'data/leads.json';
const MAX_RETRIES = 3;
const PAID_EPSILON = 0.005;

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function readLeadsRaw(): Promise<{ leads: StoredLead[]; etag: string | undefined }> {
  // useCache: false — reads here feed straight into a conditional write, so a
  // CDN-stale etag would just cause a spurious retry instead of a bug, but
  // there's no reason to pay for the extra round trip when traffic is this low.
  const result = await get(LEADS_PATH, { access: 'private', useCache: false });
  if (!result) return { leads: [], etag: undefined };
  const text = await new Response(result.stream).text();
  return { leads: JSON.parse(text) as StoredLead[], etag: result.blob.etag };
}

async function writeLeadsRaw(leads: StoredLead[], etag: string | undefined): Promise<void> {
  const options: Parameters<typeof put>[2] = {
    access: 'private',
    allowOverwrite: true,
    contentType: 'application/json',
  };
  // Omitted on the very first-ever write (no blob exists yet, so no etag to
  // match) — only matters once, and a lost race on that single write is
  // harmless (worst case: one of the two very first leads gets overwritten).
  if (etag) options.ifMatch = etag;
  await put(LEADS_PATH, JSON.stringify(leads), options);
}

// The one seam that needs conflict handling — every mutator below goes
// through this. On a concurrent write elsewhere, `put`'s ifMatch throws
// BlobPreconditionFailedError; re-read the fresh state and re-apply the
// mutation rather than silently losing whichever write lost the race.
export async function updateLeads(mutate: (leads: StoredLead[]) => StoredLead[]): Promise<StoredLead[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { leads, etag } = await readLeadsRaw();
    const next = mutate(leads);
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

// The one place a new lead's ~14 default fields get listed — insertLead and
// notifyLead.ts's blob-failure fallback both call this instead of
// duplicating the object literal.
export function newStoredLead(data: Omit<LeadData, 'id'>, id: number): StoredLead {
  const now = new Date().toISOString();
  return {
    ...data,
    id,
    status: 'new',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    telegramChatId: null,
    telegramMessageId: null,
    statusChangedAt: now,
    lastRemindedAt: null,
    createdAt: now,
    pendingPrompt: null,
    archived: false,
    customerPaidAt: null,
    pendingCommissionClaim: null,
  };
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

// Read-only lookup used to know a prompt's `kind` before parsing/validating
// the reply text (deciding "is this a number" needs no write). The actual
// resolution is the atomic primitive below.
export async function findByPendingPrompt(chatId: number, messageId: number): Promise<StoredLead | undefined> {
  const leads = await readLeads();
  return leads.find(l => l.pendingPrompt?.chatId === chatId && l.pendingPrompt?.messageId === messageId);
}

// The one atomic "answer a force-reply prompt" primitive, reused for
// deal-amount capture, the 3 edit-field prompts, and the commission claim —
// find the lead by its pending prompt, apply the caller's patch, and clear
// the prompt, all in a single updateLeads write. A duplicated Telegram
// webhook delivery's second call re-reads fresh state, finds no lead still
// pointing at {chatId,messageId} (the first call already cleared it), and
// returns undefined — no double-apply, no bespoke locking needed beyond the
// CAS retry updateLeads already does.
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

export function toggleCustomerPaid(id: number): Promise<StoredLead | undefined> {
  return updateOne(id, l => ({ ...l, customerPaidAt: l.customerPaidAt ? null : new Date().toISOString() }));
}

// Admin confirms the owner's claim: moves the claimed amount into
// paidAmount/payments and clears the claim, in one write. A duplicate
// confirm tap (or a retried webhook delivery) finds pendingCommissionClaim
// already null on the fresh re-read — returns undefined rather than the
// unchanged lead, so the webhook can tell "nothing to do" from "just
// confirmed" and skip sending a second result DM to the owner.
export async function confirmCommissionPayment(id: number): Promise<StoredLead | undefined> {
  let acted = false;
  const updated = await updateOne(id, l => {
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

// Same undefined-on-no-op convention as confirmCommissionPayment above.
export async function rejectCommissionPayment(id: number): Promise<StoredLead | undefined> {
  let acted = false;
  const updated = await updateOne(id, l => {
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

// The one place the commission/remaining/"paid off" formula is computed —
// getOwedSummary below, telegram.ts's deal notification/deals list/detail
// view/stats, and the webhook's confirm-payment flow all call this instead
// of re-deriving it.
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

// total is summed over every owed lead, but the displayed rows are capped
// (same reasoning as buildLeadList's cap in telegram.ts — Telegram's
// message-length limit, not expected to matter at this scale) so the two
// can only diverge once debt outgrows 20 open leads, which is itself worth
// noticing.
const MAX_OWED_ROWS = 20;

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
  return { rows: rows.slice(0, MAX_OWED_ROWS), total };
}
