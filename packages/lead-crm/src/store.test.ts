import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { createLeadSchema, type LeadInput, type StoredLead } from './schema.ts';
import { createLeadStore, type LeadStore } from './store.ts';
import { getCommission } from './money.ts';

let storage: MemoryStorage;
let store: LeadStore;

const baseData: LeadInput = {
  brand: 'Test',
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru',
};

// Test-only fixture helpers — write directly via updateLeads to arrange a
// won/paid lead without going through the real force-reply flow, which is
// exercised on its own terms by the resolvePendingPrompt/confirm tests below.
async function forceComplete(id: number, dealAmount: number): Promise<void> {
  await store.updateLeads((leads) =>
    leads.map((l) =>
      l.id === id ? { ...l, dealAmount, status: 'won' as const } : l,
    ),
  );
}
async function forcePay(id: number, amount: number): Promise<void> {
  await store.updateLeads((leads) =>
    leads.map((l) =>
      l.id === id
        ? {
            ...l,
            paidAmount: l.paidAmount + amount,
            payments: [...l.payments, { amount, at: new Date().toISOString() }],
          }
        : l,
    ),
  );
}
async function forceClaim(id: number, amount: number): Promise<void> {
  await store.updateLeads((leads) =>
    leads.map((l) =>
      l.id === id
        ? {
            ...l,
            pendingCommissionClaim: {
              amount,
              claimedAt: new Date().toISOString(),
            },
          }
        : l,
    ),
  );
}

beforeEach(() => {
  storage = createMemoryStorage();
  store = createLeadStore({
    storage,
    schema: createLeadSchema({
      locales: ['ru', 'en', 'sr', 'es', 'de'],
      defaultCommissionPercent: 10,
      defaultBrand: 'Test',
    }),
  });
});

describe('appendNote', () => {
  it('caps a comment that keeps getting appended to', async () => {
    const { lead } = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      comment: 'x'.repeat(3990),
    });
    expect(lead.comment).toBeTruthy();

    const merged = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      service: 'y'.repeat(500),
    });
    expect(merged.merged).toBe(true);
    expect(merged.lead.comment!.length).toBeLessThanOrEqual(4000);
  });
});

describe('insertLead', () => {
  it('assigns sequential ids starting at 1', async () => {
    const a = await store.insertLead(baseData);
    const b = await store.insertLead(baseData);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('defaults status new, 10% commission, zero paid, empty payment log, not archived, no money-track state', async () => {
    const lead = await store.insertLead(baseData);
    expect(lead.status).toBe('new');
    expect(lead.commissionPercent).toBe(10);
    expect(lead.paidAmount).toBe(0);
    expect(lead.payments).toEqual([]);
    expect(lead.pendingPrompt).toBeNull();
    expect(lead.archived).toBe(false);
    expect(lead.pendingCommissionClaim).toBeNull();
  });
});

describe('insertOrMergeLead', () => {
  const clickData = (channel: string, visitorId = 'visitor-1'): LeadInput => ({
    brand: 'Test',
    name: '',
    contact: '—',
    service: `Клик ${channel} с сайта`,
    contactChannel: channel,
    visitorId,
    locale: 'ru',
    kind: 'call_click',
  });

  it('inserts as a new lead when the visitor has no open lead yet', async () => {
    const { lead, merged } = await store.insertOrMergeLead(
      clickData('telegram'),
    );
    expect(merged).toBe(false);
    expect(lead.id).toBe(1);
  });

  it('merges a second channel click from the same visitor into the still-open lead', async () => {
    const first = await store.insertOrMergeLead(clickData('telegram'));
    const { lead, merged } = await store.insertOrMergeLead(
      clickData('whatsapp'),
    );

    expect(merged).toBe(true);
    expect(lead.id).toBe(first.lead.id);
    const all = await store.readLeads();
    expect(all).toHaveLength(1);
    expect(lead.comment).toContain('Также пробовал: Клик whatsapp с сайта');
  });

  it('upgrades a placeholder contact once real name/contact data arrives for the same visitor', async () => {
    const { lead: clicked } = await store.insertOrMergeLead(
      clickData('telegram'),
    );
    const { lead, merged } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: 'vehicle-sourcing',
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(merged).toBe(true);
    expect(lead.id).toBe(clicked.id);
    expect(lead.name).toBe('Иван');
    expect(lead.contact).toBe('@ivan');
    expect(lead.kind).toBeUndefined();
  });

  it('does not merge a different visitor — creates a separate lead', async () => {
    await store.insertOrMergeLead(clickData('telegram', 'visitor-1'));
    const { merged } = await store.insertOrMergeLead(
      clickData('telegram', 'visitor-2'),
    );
    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('keeps what the second submission actually said, not just the service name', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead, merged } = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      comment: 'Аккумулятор 60 Ah × 1 — 95 €',
    });

    expect(merged).toBe(true);
    expect(lead.comment).toContain('Аккумулятор 60 Ah × 1 — 95 €');
  });

  it('falls back to naming the service when the second submission carried no comment', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(lead.comment).toContain('Также пробовал: Клик whatsapp с сайта');
  });

  it('does not merge across brands — one store, three businesses, separate leads', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { merged } = await store.insertOrMergeLead({
      ...clickData('telegram'),
      brand: 'PRIZMA',
    });

    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('does not merge into a lead that is already being worked (status !== new)', async () => {
    const { lead } = await store.insertOrMergeLead(clickData('telegram'));
    await store.setStatus(lead.id, 'in_progress');

    const { merged } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('does not merge into an archived lead', async () => {
    const { lead } = await store.insertOrMergeLead(clickData('telegram'));
    await store.archiveLead(lead.id);

    const { merged } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(merged).toBe(false);
  });

  it('does not merge once the merge window has passed', async () => {
    const { lead } = await store.insertOrMergeLead(clickData('telegram'));
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === lead.id ? { ...l, createdAt: '2000-01-01T00:00:00.000Z' } : l,
      ),
    );

    const { merged } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(merged).toBe(false);
  });

  it('never merges without a visitorId to correlate on', async () => {
    await store.insertOrMergeLead({
      ...clickData('telegram'),
      visitorId: null,
    });
    const { merged } = await store.insertOrMergeLead({
      ...clickData('whatsapp'),
      visitorId: null,
    });
    expect(merged).toBe(false);
  });
});

describe('resolvePendingPrompt', () => {
  it('applies the patch and clears the pending prompt in one write', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 999,
      kind: 'deal_amount',
    });

    const resolved = await store.resolvePendingPrompt(111, 999, () => ({
      dealAmount: 5000,
      status: 'won',
    }));

    expect(resolved?.dealAmount).toBe(5000);
    expect(resolved?.status).toBe('won');
    expect(resolved?.pendingPrompt).toBeNull();
  });

  it('is a no-op on a duplicate delivery once the prompt is already cleared (TOCTOU regression)', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 999,
      kind: 'deal_amount',
    });
    await store.resolvePendingPrompt(111, 999, () => ({
      dealAmount: 5000,
      status: 'won',
    }));

    const second = await store.resolvePendingPrompt(111, 999, () => ({
      dealAmount: 9999,
      status: 'won',
    }));

    expect(second).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.dealAmount).toBe(5000);
  });

  it('returns undefined when no lead has a matching pending prompt', async () => {
    await store.insertLead(baseData);
    const resolved = await store.resolvePendingPrompt(1, 1, () => ({
      dealAmount: 1,
    }));
    expect(resolved).toBeUndefined();
  });
});

describe('archiveLead / unarchiveLead', () => {
  it('toggles archived', async () => {
    const lead = await store.insertLead(baseData);
    const archived = await store.archiveLead(lead.id);
    expect(archived?.archived).toBe(true);
    const restored = await store.unarchiveLead(lead.id);
    expect(restored?.archived).toBe(false);
  });
});

describe('resumeLead', () => {
  it('returns a postponed lead to in_progress and clears remindAt', async () => {
    const lead = await store.insertLead(baseData);
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === lead.id
          ? { ...l, status: 'postponed' as const, remindAt: '2026-10-20' }
          : l,
      ),
    );

    const resumed = await store.resumeLead(lead.id);

    expect(resumed?.status).toBe('in_progress');
    expect(resumed?.remindAt).toBeNull();
  });

  it('no-ops when the lead is not postponed (stale button, already finalized elsewhere)', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000); // status: 'won'

    const resumed = await store.resumeLead(lead.id);

    expect(resumed).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.status).toBe('won');
  });
});

describe('postponeLead', () => {
  it('sets status/remindAt/comment on the given lead directly, no prompt correlation needed', async () => {
    const lead = await store.insertLead(baseData);
    await store.setStatus(lead.id, 'in_progress');

    const postponed = await store.postponeLead(
      lead.id,
      '2026-10-20',
      'Отложено до 20.10.2026',
    );

    expect(postponed?.status).toBe('postponed');
    expect(postponed?.remindAt).toBe('2026-10-20');
    expect(postponed?.comment).toBe('Отложено до 20.10.2026');
  });

  it('no-ops when the lead is not in_progress (stale button, already finalized elsewhere)', async () => {
    const lead = await store.insertLead(baseData); // status: 'new'

    const postponed = await store.postponeLead(
      lead.id,
      '2026-10-20',
      'Отложено до 20.10.2026',
    );

    expect(postponed).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.status).toBe('new');
  });
});

describe('getDuePostponed', () => {
  async function forcePostpone(id: number, remindAt: string): Promise<void> {
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === id ? { ...l, status: 'postponed' as const, remindAt } : l,
      ),
    );
  }

  it('finds a postponed lead whose remindAt is today or earlier', async () => {
    const lead = await store.insertLead(baseData);
    await forcePostpone(lead.id, '2000-01-01');

    const due = await store.getDuePostponed();

    expect(due.map((l) => l.id)).toEqual([lead.id]);
  });

  it('excludes a postponed lead whose remindAt is still in the future', async () => {
    const lead = await store.insertLead(baseData);
    await forcePostpone(lead.id, '2999-01-01');

    expect(await store.getDuePostponed()).toEqual([]);
  });

  it('includes a lead whose remindAt is exactly today (boundary, <=)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    try {
      const lead = await store.insertLead(baseData);
      await forcePostpone(lead.id, '2026-10-20');

      expect((await store.getDuePostponed()).map((l) => l.id)).toEqual([
        lead.id,
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('excludes an archived lead even if its date is due', async () => {
    const lead = await store.insertLead(baseData);
    await forcePostpone(lead.id, '2000-01-01');
    await store.archiveLead(lead.id);

    expect(await store.getDuePostponed()).toEqual([]);
  });

  it('excludes leads that are not postponed', async () => {
    await store.insertLead(baseData);
    expect(await store.getDuePostponed()).toEqual([]);
  });
});

describe('deleteLead', () => {
  it('permanently removes the record, unlike archiveLead', async () => {
    const a = await store.insertLead(baseData);
    const b = await store.insertLead(baseData);

    const found = await store.deleteLead(a.id);

    expect(found).toBe(true);
    const leads = await store.readLeads();
    expect(leads.map((l) => l.id)).toEqual([b.id]);
  });

  it('returns false for an id that does not exist', async () => {
    await store.insertLead(baseData);
    const found = await store.deleteLead(999);
    expect(found).toBe(false);
  });
});

describe('claimFullCommission', () => {
  it('claims the full remaining balance, not a hardcoded/typed one', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forcePay(lead.id, 3000);

    const claimed = await store.claimFullCommission(lead.id);

    expect(claimed?.pendingCommissionClaim).toEqual({
      amount: 7000,
      claimedAt: expect.any(String),
    });
  });
});

describe('confirmCommissionPayment / rejectCommissionPayment', () => {
  it('confirm moves the claimed amount into paidAmount/payments and clears the claim', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);

    const confirmed = await store.confirmCommissionPayment(lead.id);

    expect(confirmed?.paidAmount).toBe(4000);
    expect(confirmed?.payments).toEqual([
      { amount: 4000, at: expect.any(String) },
    ]);
    expect(confirmed?.pendingCommissionClaim).toBeNull();
  });

  it('confirm is a no-op the second time (TOCTOU regression)', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);
    await store.confirmCommissionPayment(lead.id);

    const second = await store.confirmCommissionPayment(lead.id);

    expect(second).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.paidAmount).toBe(4000);
    expect(after?.payments).toHaveLength(1);
  });

  it('confirm returns undefined (not the unchanged lead) when there was never a claim to confirm', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);

    const result = await store.confirmCommissionPayment(lead.id);

    expect(result).toBeUndefined();
  });

  it('returns undefined if the claim was cleared by a concurrent write between retry attempts', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);

    // Forces one write conflict on the first attempt; right before it
    // throws, simulate another process (e.g. a duplicate webhook delivery)
    // having already resolved and cleared the claim.
    storage.failNextWrites(1, () => {
      const leads = storage.current() as StoredLead[];
      leads[0]!.pendingCommissionClaim = null;
      storage.seed(leads);
    });

    const result = await store.confirmCommissionPayment(lead.id);

    expect(result).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.paidAmount).toBe(0);
  });

  it('reject clears the claim without moving any money', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await forceClaim(lead.id, 4000);

    const rejected = await store.rejectCommissionPayment(lead.id);

    expect(rejected?.paidAmount).toBe(0);
    expect(rejected?.pendingCommissionClaim).toBeNull();
  });

  it('reject returns undefined when there was never a claim to reject (duplicate-delivery regression)', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);

    const result = await store.rejectCommissionPayment(lead.id);

    expect(result).toBeUndefined();
  });
});

describe('getOwedSummary', () => {
  it('sums remaining commission across won leads with a balance, skipping fully-paid ones', async () => {
    const a = await store.insertLead(baseData);
    await forceComplete(a.id, 100_000); // 10% commission = 10 000
    const b = await store.insertLead(baseData);
    await forceComplete(b.id, 50_000); // commission 5 000
    await forcePay(b.id, 5000); // fully paid — excluded

    const { rows, total } = await store.getOwedSummary();
    expect(rows).toEqual([
      expect.objectContaining({ id: a.id, remaining: 10_000 }),
    ]);
    expect(total).toBe(10_000);
  });

  it('excludes an archived lead even with an outstanding balance', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id, 100_000);
    await store.archiveLead(lead.id);

    const { rows, total } = await store.getOwedSummary();
    expect(rows).toEqual([]);
    expect(total).toBe(0);
  });

  it('caps displayed rows at 20 but still totals every owed lead', async () => {
    for (let i = 0; i < 25; i++) {
      const lead = await store.insertLead(baseData);
      await forceComplete(lead.id, 10_000); // commission 1 000 each
    }

    const { rows, total } = await store.getOwedSummary();

    expect(rows).toHaveLength(20);
    expect(total).toBe(25_000);
  });
});

describe('searchLeads', () => {
  it('still finds an archived lead', async () => {
    const lead = await store.insertLead(baseData);
    await store.archiveLead(lead.id);
    const results = await store.searchLeads('Иван');
    expect(results.map((l) => l.id)).toContain(lead.id);
  });

  it('returns nothing for an empty query, without scanning/matching everything', async () => {
    await store.insertLead(baseData);
    expect(await store.searchLeads('')).toEqual([]);
  });

  it('returns nothing for a whitespace-only query', async () => {
    await store.insertLead(baseData);
    expect(await store.searchLeads('   ')).toEqual([]);
  });

  it('returns nothing when no lead matches', async () => {
    await store.insertLead(baseData);
    expect(await store.searchLeads('no-such-name-or-contact')).toEqual([]);
  });
});

describe('getLead / findByPendingPrompt — not-found paths', () => {
  it('getLead returns undefined for an id that does not exist', async () => {
    await store.insertLead(baseData);
    expect(await store.getLead(999)).toBeUndefined();
  });

  it('findByPendingPrompt returns undefined when no lead has a pending prompt at all', async () => {
    await store.insertLead(baseData);
    expect(await store.findByPendingPrompt(111, 999)).toBeUndefined();
  });

  it('findByPendingPrompt returns undefined for a chatId/messageId that does not match the pending one', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 555,
      kind: 'deal_amount',
    });
    expect(await store.findByPendingPrompt(111, 556)).toBeUndefined(); // wrong messageId
    expect(await store.findByPendingPrompt(222, 555)).toBeUndefined(); // wrong chatId
  });
});

describe('getCommission', () => {
  it('uses the rate stored on the lead, so brands on different rates differ', () => {
    const sourcing = getCommission({
      dealAmount: 1000,
      commissionPercent: 10,
      paidAmount: 0,
    });
    const detailing = getCommission({
      dealAmount: 1000,
      commissionPercent: 50,
      paidAmount: 0,
    });

    expect(sourcing.commission).toBe(100);
    expect(detailing.commission).toBe(500);
  });

  it('computes commission and remaining from dealAmount/commissionPercent/paidAmount', () => {
    const info = getCommission({
      dealAmount: 100_000,
      commissionPercent: 10,
      paidAmount: 3000,
    });
    expect(info.commission).toBe(10_000);
    expect(info.remaining).toBe(7000);
    expect(info.isPaidOff).toBe(false);
  });

  it('treats a null dealAmount as zero', () => {
    const info = getCommission({
      dealAmount: null,
      commissionPercent: 10,
      paidAmount: 0,
    });
    expect(info.commission).toBe(0);
    expect(info.isPaidOff).toBe(true);
  });

  it('stays isPaidOff when overpaid (remaining goes negative) instead of flagging still-owed', () => {
    const info = getCommission({
      dealAmount: 100_000,
      commissionPercent: 10,
      paidAmount: 15_000,
    });
    expect(info.remaining).toBe(-5000);
    expect(info.isPaidOff).toBe(true);
  });

  it('is paid off within the rounding epsilon', () => {
    const info = getCommission({
      dealAmount: 100_000,
      commissionPercent: 10,
      paidAmount: 9999.999,
    });
    expect(info.isPaidOff).toBe(true);
  });
});

// Writes raw JSON directly into the fake blob, bypassing insertLead — the
// only way to simulate a legacy record written before a schema field
// existed, or a genuinely malformed one.
function seedRawBlob(records: unknown[]): void {
  storage.seed(records);
}

describe('readLeads — schema validation on the way in', () => {
  it('backfills fields a legacy record predates with their defaults', async () => {
    seedRawBlob([
      {
        id: 1,
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        // status, dealAmount, commissionPercent, paidAmount, payments, archived,
        // pendingCommissionClaim, pendingPrompt — all omitted,
        // as if written before this field existed.
      },
    ]);

    const [lead] = await store.readLeads();

    expect(lead.status).toBe('new');
    expect(lead.commissionPercent).toBe(10);
    expect(lead.paidAmount).toBe(0);
    expect(lead.payments).toEqual([]);
    expect(lead.archived).toBe(false);
    expect(lead.pendingCommissionClaim).toBeNull();
    expect(lead.pendingPrompt).toBeNull();
  });

  it('clears a stale pendingPrompt.kind retired by a later release instead of dropping the whole lead (production incident, 2026-09-03)', async () => {
    seedRawBlob([
      {
        id: 1,
        name: 'Test',
        contact: '@test',
        service: 'vehicle-sourcing',
        locale: 'ru',
        status: 'won',
        dealAmount: 300,
        statusChangedAt: 'x',
        createdAt: 'x',
        pendingPrompt: { chatId: 1, messageId: 1, kind: 'commission_claim' },
      },
    ]);

    const [lead] = await store.readLeads();

    expect(lead).toBeDefined();
    expect(lead.dealAmount).toBe(300);
    expect(lead.pendingPrompt).toBeNull();
  });

  it('drops a record missing a required field, without losing the other valid leads', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedRawBlob([
      {
        id: 1,
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
      },
      {
        id: 2,
        name: 'Пётр',
        /* contact missing — genuinely corrupt */ service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
      },
      {
        id: 3,
        name: 'Олег',
        contact: '@oleg',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
      },
    ]);

    const leads = await store.readLeads();

    expect(leads.map((l) => l.id)).toEqual([1, 3]);
    expect(errorSpy).toHaveBeenCalledWith(
      '[lead-crm] dropping a corrupt lead record on read',
      expect.objectContaining({ entry: expect.objectContaining({ id: 2 }) }),
    );
    errorSpy.mockRestore();
  });

  it('rejects a wrong-type value on a field that does exist, rather than coercing it', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedRawBlob([
      {
        id: 1,
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
        paidAmount: '5000',
      },
    ]);

    expect(await store.readLeads()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('updateLeads conflict retry', () => {
  it('re-reads and re-applies the mutation after a precondition-failed write', async () => {
    await store.insertLead(baseData);
    const before = storage.writeAttempts();
    storage.failNextWrites(1);

    const result = await store.updateLeads((leads: StoredLead[]) =>
      leads.map((l) => ({ ...l, name: 'Пётр' })),
    );

    expect(result[0]!.name).toBe('Пётр');
    expect(storage.writeAttempts() - before).toBe(2);
  });

  it('gives up and throws after exhausting all retries against a persistent conflict', async () => {
    await store.insertLead(baseData);
    const before = storage.writeAttempts();
    storage.failNextWrites(Number.POSITIVE_INFINITY);

    vi.useFakeTimers();
    try {
      const pending = store.updateLeads((leads: StoredLead[]) =>
        leads.map((l) => ({ ...l, name: 'Пётр' })),
      );
      const assertion = expect(pending).rejects.toThrow(
        'storage write conflict',
      );
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(storage.writeAttempts() - before).toBe(6); // MAX_RETRIES, no more
  });
});

describe('setTelegramMessage', () => {
  it('records where the lead was announced so the card can be edited later', async () => {
    const lead = await store.insertLead(baseData);

    const updated = await store.setTelegramMessage(lead.id, -100, 999);

    expect(updated).toMatchObject({
      telegramChatId: -100,
      telegramMessageId: 999,
    });
    expect(await store.getLead(lead.id)).toMatchObject({
      telegramChatId: -100,
      telegramMessageId: 999,
    });
  });

  it('is a no-op for an id that is not in the store', async () => {
    await expect(
      store.setTelegramMessage(999, -100, 1),
    ).resolves.toBeUndefined();
  });
});

describe('updateLeads — failures that are not write conflicts', () => {
  it('propagates a storage failure instead of burning retries on it', async () => {
    await store.insertLead(baseData);
    const boom = new Error('storage is down');
    const failing = {
      read: storage.read,
      write: vi.fn().mockRejectedValue(boom),
    };
    const brokenStore = createLeadStore({
      storage: failing,
      schema: createLeadSchema({
        locales: ['ru'],
        defaultCommissionPercent: 10,
        defaultBrand: 'Test',
      }),
    });

    await expect(brokenStore.updateLeads((leads) => leads)).rejects.toBe(boom);
    // One attempt, not MAX_RETRIES — a broken backend is not a lost race.
    expect(failing.write).toHaveBeenCalledTimes(1);
  });
});

describe('readLeads — a record that is not a list at all', () => {
  it('treats a truncated, non-array payload as empty instead of throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.seed({ oops: 'this is not a list of leads' });

    await expect(store.readLeads()).resolves.toEqual([]);

    expect(errorSpy).toHaveBeenCalledWith(
      '[lead-crm] stored leads are not an array — treating as empty',
      { type: 'object' },
    );
    errorSpy.mockRestore();
  });

  it('still accepts a write afterwards, so a corrupt record self-heals', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.seed('garbage');

    const lead = await store.insertLead(baseData);

    expect(lead.id).toBe(1);
    expect(await store.readLeads()).toHaveLength(1);
    vi.restoreAllMocks();
  });
});

describe('per-business store defaults', () => {
  it('stamps new leads with the business own commission rate', async () => {
    const detailingStore = createLeadStore({
      storage: createMemoryStorage(),
      schema: createLeadSchema({
        locales: ['ru'],
        defaultCommissionPercent: 50,
        defaultBrand: 'Test',
      }),
    });

    const lead = await detailingStore.insertLead(baseData);

    expect(lead.commissionPercent).toBe(50);
  });
});
