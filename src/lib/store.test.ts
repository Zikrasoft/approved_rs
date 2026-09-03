import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fake blob storage: a single in-memory slot standing in for the real Blob
// store, plus a switch to force one precondition-failed write so
// updateLeads's retry-on-conflict path can actually be exercised.
let storedContent: string | undefined;
let storedEtag: string | undefined;
let etagCounter = 0;
let forceConflictOnce = false;
let forceConflictAlways = false;

vi.mock('@vercel/blob', () => {
  class BlobPreconditionFailedError extends Error {}
  return {
    BlobPreconditionFailedError,
    get: vi.fn(async () => {
      if (storedContent === undefined) return null;
      return { stream: new Response(storedContent).body, blob: { etag: storedEtag } };
    }),
    put: vi.fn(async (_path: string, body: string, opts: { ifMatch?: string }) => {
      if (forceConflictAlways) {
        throw new BlobPreconditionFailedError('precondition failed');
      }
      if (forceConflictOnce) {
        forceConflictOnce = false;
        throw new BlobPreconditionFailedError('precondition failed');
      }
      if (opts.ifMatch && opts.ifMatch !== storedEtag) {
        throw new BlobPreconditionFailedError('precondition failed');
      }
      storedContent = body;
      storedEtag = `etag-${++etagCounter}`;
      return { etag: storedEtag };
    }),
  };
});

import { put } from '@vercel/blob';
import {
  insertLead, setStatus, setPendingPrompt, findByPendingPrompt, resolvePendingPrompt, archiveLead, unarchiveLead,
  toggleCustomerPaid, confirmCommissionPayment, rejectCommissionPayment, markReminded, getStaleLeads,
  getOwedSummary, getCommission, searchLeads, getLead, readLeads, updateLeads, type StoredLead,
} from './store';
import type { LeadData } from './leadTypes';

const baseData: Omit<LeadData, 'id'> = { name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing', locale: 'ru' };

// Test-only fixture helpers — write directly via updateLeads to arrange a
// won/paid lead without going through the real force-reply flow, which is
// exercised on its own terms by the resolvePendingPrompt/confirm tests below.
async function forceComplete(id: number, dealAmount: number): Promise<void> {
  await updateLeads(leads => leads.map(l => (l.id === id ? { ...l, dealAmount, status: 'won' as const } : l)));
}
async function forcePay(id: number, amount: number): Promise<void> {
  await updateLeads(leads => leads.map(l => (l.id === id
    ? { ...l, paidAmount: l.paidAmount + amount, payments: [...l.payments, { amount, at: new Date().toISOString() }] }
    : l)));
}
async function forceClaim(id: number, amount: number): Promise<void> {
  await updateLeads(leads => leads.map(l => (l.id === id
    ? { ...l, pendingCommissionClaim: { amount, claimedAt: new Date().toISOString() } }
    : l)));
}

beforeEach(() => {
  storedContent = undefined;
  storedEtag = undefined;
  etagCounter = 0;
  forceConflictOnce = false;
  forceConflictAlways = false;
  vi.mocked(put).mockClear();
});

describe('insertLead', () => {
  it('assigns sequential ids starting at 1', async () => {
    const a = await insertLead(baseData);
    const b = await insertLead(baseData);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('defaults status new, 10% commission, zero paid, empty payment log, not archived, no money-track state', async () => {
    const lead = await insertLead(baseData);
    expect(lead.status).toBe('new');
    expect(lead.commissionPercent).toBe(10);
    expect(lead.paidAmount).toBe(0);
    expect(lead.payments).toEqual([]);
    expect(lead.pendingPrompt).toBeNull();
    expect(lead.archived).toBe(false);
    expect(lead.customerPaidAt).toBeNull();
    expect(lead.pendingCommissionClaim).toBeNull();
  });
});

describe('resolvePendingPrompt', () => {
  it('applies the patch and clears the pending prompt in one write', async () => {
    const lead = await insertLead(baseData);
    await setPendingPrompt(lead.id, { chatId: 111, messageId: 999, kind: 'deal_amount' });

    const resolved = await resolvePendingPrompt(111, 999, () => ({ dealAmount: 5000, status: 'won' }));

    expect(resolved?.dealAmount).toBe(5000);
    expect(resolved?.status).toBe('won');
    expect(resolved?.pendingPrompt).toBeNull();
  });

  it('is a no-op on a duplicate delivery once the prompt is already cleared (TOCTOU regression)', async () => {
    const lead = await insertLead(baseData);
    await setPendingPrompt(lead.id, { chatId: 111, messageId: 999, kind: 'deal_amount' });
    await resolvePendingPrompt(111, 999, () => ({ dealAmount: 5000, status: 'won' }));

    const second = await resolvePendingPrompt(111, 999, () => ({ dealAmount: 9999, status: 'won' }));

    expect(second).toBeUndefined();
    const after = await getLead(lead.id);
    expect(after?.dealAmount).toBe(5000);
  });

  it('returns undefined when no lead has a matching pending prompt', async () => {
    await insertLead(baseData);
    const resolved = await resolvePendingPrompt(1, 1, () => ({ dealAmount: 1 }));
    expect(resolved).toBeUndefined();
  });
});

describe('archiveLead / unarchiveLead', () => {
  it('toggles archived', async () => {
    const lead = await insertLead(baseData);
    const archived = await archiveLead(lead.id);
    expect(archived?.archived).toBe(true);
    const restored = await unarchiveLead(lead.id);
    expect(restored?.archived).toBe(false);
  });
});

describe('toggleCustomerPaid', () => {
  it('flips customerPaidAt between null and a timestamp', async () => {
    const lead = await insertLead(baseData);
    const marked = await toggleCustomerPaid(lead.id);
    expect(marked?.customerPaidAt).not.toBeNull();
    const unmarked = await toggleCustomerPaid(lead.id);
    expect(unmarked?.customerPaidAt).toBeNull();
  });
});

describe('confirmCommissionPayment / rejectCommissionPayment', () => {
  it('confirm moves the claimed amount into paidAmount/payments and clears the claim', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);

    const confirmed = await confirmCommissionPayment(lead.id);

    expect(confirmed?.paidAmount).toBe(4000);
    expect(confirmed?.payments).toEqual([{ amount: 4000, at: expect.any(String) }]);
    expect(confirmed?.pendingCommissionClaim).toBeNull();
  });

  it('confirm is a no-op the second time (TOCTOU regression)', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);
    await confirmCommissionPayment(lead.id);

    const second = await confirmCommissionPayment(lead.id);

    expect(second).toBeUndefined();
    const after = await getLead(lead.id);
    expect(after?.paidAmount).toBe(4000);
    expect(after?.payments).toHaveLength(1);
  });

  it('confirm returns undefined (not the unchanged lead) when there was never a claim to confirm', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);

    const result = await confirmCommissionPayment(lead.id);

    expect(result).toBeUndefined();
  });

  it('reject clears the claim without moving any money', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);

    const rejected = await rejectCommissionPayment(lead.id);

    expect(rejected?.paidAmount).toBe(0);
    expect(rejected?.pendingCommissionClaim).toBeNull();
  });

  it('reject returns undefined when there was never a claim to reject (duplicate-delivery regression)', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);

    const result = await rejectCommissionPayment(lead.id);

    expect(result).toBeUndefined();
  });
});

describe('getStaleLeads', () => {
  afterEach(() => vi.useRealTimers());

  it('only returns in_progress leads older than the days cutoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const lead = await insertLead(baseData);
    await setStatus(lead.id, 'in_progress');

    vi.setSystemTime(new Date('2026-01-07T00:00:00.000Z')); // +6 days
    expect(await getStaleLeads(5)).toHaveLength(1);
    expect(await getStaleLeads(10)).toEqual([]);
  });

  it('excludes a lead already reminded since its last status change', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const lead = await insertLead(baseData);
    await setStatus(lead.id, 'in_progress');
    await markReminded(lead.id);

    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    expect(await getStaleLeads(5)).toEqual([]);
  });

  it('excludes an archived lead even if otherwise stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const lead = await insertLead(baseData);
    await setStatus(lead.id, 'in_progress');
    await archiveLead(lead.id);

    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    expect(await getStaleLeads(5)).toEqual([]);
  });
});

describe('getOwedSummary', () => {
  it('sums remaining commission across won leads with a balance, skipping fully-paid ones', async () => {
    const a = await insertLead(baseData);
    await forceComplete(a.id, 100_000); // 10% commission = 10 000
    const b = await insertLead(baseData);
    await forceComplete(b.id, 50_000); // commission 5 000
    await forcePay(b.id, 5000); // fully paid — excluded

    const { rows, total } = await getOwedSummary();
    expect(rows).toEqual([expect.objectContaining({ id: a.id, remaining: 10_000 })]);
    expect(total).toBe(10_000);
  });

  it('excludes an archived lead even with an outstanding balance', async () => {
    const lead = await insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await archiveLead(lead.id);

    const { rows, total } = await getOwedSummary();
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  it('caps displayed rows at 20 but still totals every owed lead', async () => {
    for (let i = 0; i < 25; i++) {
      const lead = await insertLead(baseData);
      await forceComplete(lead.id, 10_000); // commission 1 000 each
    }

    const { rows, total } = await getOwedSummary();

    expect(rows).toHaveLength(20);
    expect(total).toBe(25_000);
  });
});

describe('searchLeads', () => {
  it('still finds an archived lead', async () => {
    const lead = await insertLead(baseData);
    await archiveLead(lead.id);
    const results = await searchLeads('Иван');
    expect(results.map(l => l.id)).toContain(lead.id);
  });

  it('returns nothing for an empty query, without scanning/matching everything', async () => {
    await insertLead(baseData);
    expect(await searchLeads('')).toEqual([]);
  });

  it('returns nothing for a whitespace-only query', async () => {
    await insertLead(baseData);
    expect(await searchLeads('   ')).toEqual([]);
  });

  it('returns nothing when no lead matches', async () => {
    await insertLead(baseData);
    expect(await searchLeads('no-such-name-or-contact')).toEqual([]);
  });
});

describe('getLead / findByPendingPrompt — not-found paths', () => {
  it('getLead returns undefined for an id that does not exist', async () => {
    await insertLead(baseData);
    expect(await getLead(999)).toBeUndefined();
  });

  it('findByPendingPrompt returns undefined when no lead has a pending prompt at all', async () => {
    await insertLead(baseData);
    expect(await findByPendingPrompt(111, 999)).toBeUndefined();
  });

  it('findByPendingPrompt returns undefined for a chatId/messageId that does not match the pending one', async () => {
    const lead = await insertLead(baseData);
    await setPendingPrompt(lead.id, { chatId: 111, messageId: 555, kind: 'deal_amount' });
    expect(await findByPendingPrompt(111, 556)).toBeUndefined(); // wrong messageId
    expect(await findByPendingPrompt(222, 555)).toBeUndefined(); // wrong chatId
  });
});

describe('getCommission', () => {
  it('computes commission and remaining from dealAmount/commissionPercent/paidAmount', () => {
    const info = getCommission({ dealAmount: 100_000, commissionPercent: 10, paidAmount: 3000 });
    expect(info.commission).toBe(10_000);
    expect(info.remaining).toBe(7000);
    expect(info.isPaidOff).toBe(false);
  });

  it('treats a null dealAmount as zero', () => {
    const info = getCommission({ dealAmount: null, commissionPercent: 10, paidAmount: 0 });
    expect(info.commission).toBe(0);
    expect(info.isPaidOff).toBe(true);
  });

  it('stays isPaidOff when overpaid (remaining goes negative) instead of flagging still-owed', () => {
    const info = getCommission({ dealAmount: 100_000, commissionPercent: 10, paidAmount: 15_000 });
    expect(info.remaining).toBe(-5000);
    expect(info.isPaidOff).toBe(true);
  });

  it('is paid off within the rounding epsilon', () => {
    const info = getCommission({ dealAmount: 100_000, commissionPercent: 10, paidAmount: 9999.999 });
    expect(info.isPaidOff).toBe(true);
  });
});

// Writes raw JSON directly into the fake blob, bypassing insertLead — the
// only way to simulate a legacy record written before a schema field
// existed, or a genuinely malformed one.
function seedRawBlob(records: unknown[]): void {
  storedContent = JSON.stringify(records);
  storedEtag = `etag-${++etagCounter}`;
}

describe('readLeads — schema validation on the way in', () => {
  it('backfills fields a legacy record predates with their defaults', async () => {
    seedRawBlob([{
      id: 1, name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing', locale: 'ru',
      statusChangedAt: '2026-01-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z',
      // status, dealAmount, commissionPercent, paidAmount, payments, archived,
      // customerPaidAt, pendingCommissionClaim, pendingPrompt — all omitted,
      // as if written before this field existed.
    }]);

    const [lead] = await readLeads();

    expect(lead.status).toBe('new');
    expect(lead.commissionPercent).toBe(10);
    expect(lead.paidAmount).toBe(0);
    expect(lead.payments).toEqual([]);
    expect(lead.archived).toBe(false);
    expect(lead.customerPaidAt).toBeNull();
    expect(lead.pendingCommissionClaim).toBeNull();
    expect(lead.pendingPrompt).toBeNull();
  });

  it('drops a record missing a required field, without losing the other valid leads', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedRawBlob([
      { id: 1, name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing', locale: 'ru', statusChangedAt: 'x', createdAt: 'x' },
      { id: 2, name: 'Пётр', /* contact missing — genuinely corrupt */ service: 'vehicle-sourcing', locale: 'ru', statusChangedAt: 'x', createdAt: 'x' },
      { id: 3, name: 'Олег', contact: '@oleg', service: 'vehicle-sourcing', locale: 'ru', statusChangedAt: 'x', createdAt: 'x' },
    ]);

    const leads = await readLeads();

    expect(leads.map(l => l.id)).toEqual([1, 3]);
    expect(errorSpy).toHaveBeenCalledWith(
      '[store] dropping a corrupt lead record on read',
      expect.objectContaining({ entry: expect.objectContaining({ id: 2 }) }),
    );
    errorSpy.mockRestore();
  });

  it('rejects a wrong-type value on a field that does exist, rather than coercing it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedRawBlob([
      { id: 1, name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing', locale: 'ru', statusChangedAt: 'x', createdAt: 'x', paidAmount: '5000' },
    ]);

    expect(await readLeads()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('updateLeads conflict retry', () => {
  it('re-reads and re-applies the mutation after a precondition-failed write', async () => {
    await insertLead(baseData);
    vi.mocked(put).mockClear();
    forceConflictOnce = true;

    const result = await updateLeads((leads: StoredLead[]) => leads.map(l => ({ ...l, name: 'Пётр' })));

    expect(result[0].name).toBe('Пётр');
    expect(vi.mocked(put)).toHaveBeenCalledTimes(2);
  });

  it('gives up and throws after exhausting all retries against a persistent conflict', async () => {
    await insertLead(baseData);
    vi.mocked(put).mockClear();
    forceConflictAlways = true;

    await expect(updateLeads((leads: StoredLead[]) => leads.map(l => ({ ...l, name: 'Пётр' }))))
      .rejects.toThrow('precondition failed');
    expect(vi.mocked(put)).toHaveBeenCalledTimes(3); // MAX_RETRIES, no more
  });
});
