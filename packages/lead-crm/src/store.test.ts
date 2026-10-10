import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { storedLeadSchema, type LeadInput, type StoredLead } from './schema.ts';
import {
  createLeadStore,
  GHOST_LEAD_RETENTION_MS,
  postponePatch,
  resumePatch,
  statusPatch,
  VISITOR_MERGE_WINDOW_MS,
  type LeadStore,
} from './store.ts';
import { createQuarantine, LEADS_PATH } from './quarantine.ts';

let storage: MemoryStorage;
let store: LeadStore;

const baseData: LeadInput = {
  brand: 'Test',
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru',
};

async function forceComplete(id: number): Promise<void> {
  await store.updateLeads((leads) =>
    leads.map((l) => (l.id === id ? { ...l, status: 'won' as const } : l)),
  );
}

beforeEach(() => {
  storage = createMemoryStorage();
  store = createLeadStore({
    storage,
    schema: storedLeadSchema,
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

  it('keeps the newest note when the cap forces something out', async () => {
    await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      comment: 'x'.repeat(3990),
    });

    const merged = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      service: 'newest-service',
    });
    expect(merged.lead.comment).toContain('newest-service');
  });
});

describe('insertLead', () => {
  it('assigns sequential ids starting at 1', async () => {
    const a = await store.insertLead(baseData);
    const b = await store.insertLead(baseData);
    expect(a.id).toBe(1);
    expect(b.id).toBe(2);
  });

  it('defaults status open, no prompt and no money on the Lead', async () => {
    const lead = await store.insertLead(baseData);
    expect(lead.status).toBe('open');
    expect(lead.pendingPrompt).toBeNull();
    expect(lead).not.toHaveProperty('archived');
    expect(lead).not.toHaveProperty('commissionPercent');
    expect(lead).not.toHaveProperty('incomes');
  });
});

describe('insertOrMergeLead', () => {
  const clickData = (channel: string, visitorId = 'visitor-1'): LeadInput => ({
    brand: 'Test',
    name: '',
    contact: '—',
    service: '',
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
    expect(lead.comment).toContain('Также пробовал: WhatsApp');
  });

  it('upgrades a placeholder contact once real name/contact data arrives, without forgetting the lead began as a click', async () => {
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
    expect(lead.kind).toBe('call_click');
    expect(lead.services).toEqual([]);
    expect(lead.contactChannel).toBe('telegram');
  });

  it('records the channel the form chose, not the one the earlier click used', async () => {
    await store.insertOrMergeLead(clickData('phone'));
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      contactChannel: 'telegram',
      service: 'vehicle-sourcing',
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.contact).toBe('@ivan');
    expect(lead.contactChannel).toBe('telegram');
  });

  it('replaces the call-click service list with every service the form carried', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: 'polishing',
      services: ['polishing', 'ppf'],
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.service).toBe('polishing');
    expect(lead.services).toEqual(['polishing', 'ppf']);
  });

  it('keeps the service already on the lead when the form that upgrades the contact carried none', async () => {
    await store.insertOrMergeLead({
      ...clickData('whatsapp'),
      service: 'polishing',
      services: ['polishing'],
    });
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: '',
      services: [],
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.service).toBe('polishing');
    expect(lead.services).toEqual(['polishing']);
  });

  it('adds no "Также пробовал" note for a form submission that named no service', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: '',
      contactChannel: 'telegram',
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.comment).not.toContain('Также пробовал');
  });

  it('writes no note for a click whose channel never reached the record', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead } = await store.insertOrMergeLead({
      ...clickData('telegram'),
      contactChannel: undefined,
    });

    expect(lead.comment).not.toContain('Также пробовал');
  });

  it('hands back the Lead as it was before the merge, and null for an insert', async () => {
    const first = await store.insertOrMergeLead(clickData('telegram'));
    const second = await store.insertOrMergeLead({
      ...clickData('telegram'),
      contact: '@petr',
      telegramId: 77,
      referredBy: 'approved',
    });

    expect(first.before).toBeNull();
    expect(second.before).toEqual(first.lead);
    expect(second.lead).toMatchObject({
      contact: '@petr',
      referredBy: 'approved',
    });
  });

  it('hands a Telegram click over to the capture bot that picks up the same visitor', async () => {
    await store.insertOrMergeLead({
      ...clickData('telegram'),
      source_url: 'https://approved.rs/sr/cases/x/',
    });
    const { lead, merged } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Петр',
      contact: '@petr',
      service: '',
      contactChannel: 'telegram',
      source_url: null,
      visitorId: 'visitor-1',
      locale: 'sr',
      kind: 'lead',
      telegramId: 77,
      capturePrompt: { chatId: 77, step: 'looking_for' },
    });

    expect(merged).toBe(true);
    expect(lead).toMatchObject({
      contact: '@petr',
      kind: 'lead',
      source_url: 'https://approved.rs/sr/cases/x/',
      telegramId: 77,
      capturePrompt: { chatId: 77, step: 'looking_for' },
    });
    expect(lead.comment ?? '').not.toContain('Сначала кликнул');
  });

  it('keeps a bot lead apart from a form the same visitor already sent', async () => {
    await store.insertOrMergeLead({
      ...clickData('phone'),
      name: 'Иван',
      contact: '+381601234567',
      kind: 'lead',
    });
    const { merged } = await store.insertOrMergeLead({
      ...clickData('telegram'),
      name: 'Петр',
      contact: '@petr',
      kind: 'lead',
      telegramId: 77,
    });

    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('still notes the other channel a bot lead was clicked through first', async () => {
    await store.insertOrMergeLead(clickData('whatsapp'));
    const { lead } = await store.insertOrMergeLead({
      ...clickData('telegram'),
      name: 'Петр',
      contact: '@petr',
      kind: 'lead',
      telegramId: 77,
    });

    expect(lead.comment).toContain('Сначала кликнул: WhatsApp');
  });

  it('still notes a repeat click on the same channel when no bot is involved', async () => {
    await store.insertOrMergeLead(clickData('whatsapp'));
    const { lead } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(lead.comment).toContain('Также пробовал: WhatsApp');
  });

  it('fills the page in when the Telegram click lands after the bot already wrote the lead', async () => {
    await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Петр',
      contact: '@petr',
      service: '',
      contactChannel: 'telegram',
      visitorId: 'visitor-1',
      locale: 'sr',
      telegramId: 77,
    });
    const { lead } = await store.insertOrMergeLead({
      ...clickData('telegram'),
      source_url: 'https://approved.rs/sr/',
    });

    expect(lead.source_url).toBe('https://approved.rs/sr/');
    expect(lead.telegramId).toBe(77);
    expect(lead.comment ?? '').not.toContain('Также пробовал');
  });

  it('remembers which channel the visitor clicked before the form replaced it', async () => {
    await store.insertOrMergeLead(clickData('whatsapp'));
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: '',
      contactChannel: 'telegram',
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.contactChannel).toBe('telegram');
    expect(lead.service).toBe('');
    expect(lead.comment).toContain('Сначала кликнул: WhatsApp');
  });

  it('names every service of the second submission in the merge note', async () => {
    await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: 'polishing',
      visitorId: 'visitor-1',
      locale: 'ru',
    });
    const { lead } = await store.insertOrMergeLead({
      brand: 'Test',
      name: 'Иван',
      contact: '@ivan',
      service: 'ppf',
      services: ['ppf', 'ceramic-coating'],
      visitorId: 'visitor-1',
      locale: 'ru',
    });

    expect(lead.comment).toContain('Также пробовал: ppf, ceramic-coating');
  });

  it('does not merge a different visitor — creates a separate lead', async () => {
    await store.insertOrMergeLead(clickData('telegram', 'visitor-1'));
    const { merged } = await store.insertOrMergeLead(
      clickData('telegram', 'visitor-2'),
    );
    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('keeps both the service name and what the second submission actually said', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead, merged } = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
      comment: 'Аккумулятор 60 Ah × 1 — 95 €',
    });

    expect(merged).toBe(true);
    expect(lead.comment).toContain('Аккумулятор 60 Ah × 1 — 95 €');
    expect(lead.comment).toContain(`Также пробовал: ${baseData.service}`);
  });

  it('falls back to naming the clicked channel when the second submission carried no comment', async () => {
    await store.insertOrMergeLead(clickData('telegram'));
    const { lead } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(lead.comment).toContain('Также пробовал: WhatsApp');
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

  it('does not merge into a lead the owner already marked in work', async () => {
    const { lead } = await store.insertOrMergeLead(clickData('telegram'));
    await store.touchLead(lead.id);

    const { merged } = await store.insertOrMergeLead(clickData('whatsapp'));

    expect(merged).toBe(false);
    expect(await store.readLeads()).toHaveLength(2);
  });

  it('does not merge into a lost lead', async () => {
    const { lead } = await store.insertOrMergeLead(clickData('telegram'));
    await store.setStatus(lead.id, 'lost');

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
      kind: 'postpone',
    });

    const resolved = await store.resolvePendingPrompt(
      { chatId: 111, messageId: 999 },
      () => ({
        comment: 'first',
        status: 'won',
      }),
    );

    expect(resolved?.comment).toBe('first');
    expect(resolved?.status).toBe('won');
    expect(resolved?.pendingPrompt).toBeNull();
  });

  it('is a no-op on a duplicate delivery once the prompt is already cleared (TOCTOU regression)', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 999,
      kind: 'postpone',
    });
    await store.resolvePendingPrompt({ chatId: 111, messageId: 999 }, () => ({
      comment: 'first',
      status: 'won',
    }));

    const second = await store.resolvePendingPrompt(
      { chatId: 111, messageId: 999 },
      () => ({
        comment: 'second',
        status: 'won',
      }),
    );

    expect(second).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.comment).toBe('first');
  });

  it('returns undefined when a concurrent write clears the prompt between retry attempts', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 999,
      kind: 'postpone',
    });
    storage.failNextWrites(1, () => {
      const leads = storage.current() as StoredLead[];
      leads[0]!.pendingPrompt = null;
      storage.seed(leads);
    });

    const resolved = await store.resolvePendingPrompt(
      { chatId: 111, messageId: 999 },
      () => ({
        comment: 'late',
      }),
    );

    expect(resolved).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.comment).toBeUndefined();
  });

  it('returns undefined when no lead has a matching pending prompt', async () => {
    await store.insertLead(baseData);
    const resolved = await store.resolvePendingPrompt(
      { chatId: 1, messageId: 1 },
      () => ({
        comment: 'x',
      }),
    );
    expect(resolved).toBeUndefined();
  });
});

describe('status patch builders', () => {
  const AT = new Date('2026-10-08T10:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ now: AT });
    return () => vi.useRealTimers();
  });

  async function storedLead(patch: Partial<StoredLead> = {}) {
    const lead = await store.insertLead(baseData);
    return { ...lead, ...patch };
  }

  it('statusPatch stamps the change time', () => {
    expect(statusPatch('open')).toEqual({
      status: 'open',
      statusChangedAt: AT.toISOString(),
    });
    expect(statusPatch('lost', new Date(0)).statusChangedAt).toBe(
      new Date(0).toISOString(),
    );
  });

  it('postponePatch sets the date and resumePatch reopens', async () => {
    const lead = await storedLead({ status: 'open' });

    const postponed = { ...lead, ...postponePatch(lead, '2026-10-20', 'n') };

    expect(postponed).toMatchObject({
      status: 'postponed',
      remindAt: '2026-10-20',
      statusChangedAt: AT.toISOString(),
    });
    expect(resumePatch()).toEqual({
      status: 'open',
      remindAt: null,
      statusChangedAt: AT.toISOString(),
    });
  });
});

describe('resumeLead', () => {
  it('returns a postponed lead to open and clears remindAt', async () => {
    const lead = await store.insertLead(baseData);
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === lead.id
          ? { ...l, status: 'postponed' as const, remindAt: '2026-10-20' }
          : l,
      ),
    );

    const resumed = await store.resumeLead(lead.id);

    expect(resumed?.status).toBe('open');
    expect(resumed?.remindAt).toBeNull();
  });

  it('no-ops when the lead is not postponed (stale button, already finalized elsewhere)', async () => {
    const lead = await store.insertLead(baseData);
    await forceComplete(lead.id);

    const resumed = await store.resumeLead(lead.id);

    expect(resumed).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.status).toBe('won');
  });
});

describe('postponeLead', () => {
  it('sets status/remindAt/comment on the given lead directly, no prompt correlation needed', async () => {
    const lead = await store.insertLead(baseData);

    const postponed = await store.postponeLead(
      lead.id,
      '2026-10-20',
      'Отложено до 20.10.2026',
    );

    expect(postponed?.status).toBe('postponed');
    expect(postponed?.remindAt).toBe('2026-10-20');
    expect(postponed?.comment).toBe('Отложено до 20.10.2026');
  });

  it('no-ops when the lead is no longer open (stale button, already finalized elsewhere)', async () => {
    const lead = await store.insertLead(baseData);
    await store.setStatus(lead.id, 'lost');

    const postponed = await store.postponeLead(
      lead.id,
      '2026-10-20',
      'Отложено до 20.10.2026',
    );

    expect(postponed).toBeUndefined();
    const after = await store.getLead(lead.id);
    expect(after?.status).toBe('lost');
  });
});

describe('expireGhostLeads', () => {
  const clickData: LeadInput = {
    ...baseData,
    name: '',
    contact: '—',
    service: '',
    kind: 'call_click',
    contactChannel: 'telegram',
  };
  const NOW = new Date('2026-10-02T12:00:00.000Z');
  const DAY_MS = GHOST_LEAD_RETENTION_MS;

  async function forceAge(id: number, ms: number): Promise<void> {
    await store.updateLeads((leads) =>
      leads.map((l) =>
        l.id === id
          ? { ...l, createdAt: new Date(NOW.getTime() - ms).toISOString() }
          : l,
      ),
    );
  }

  async function ghost(
    overrides: Partial<LeadInput> = {},
    ageMs = DAY_MS + 1,
  ): Promise<StoredLead> {
    const lead = await store.insertLead({ ...clickData, ...overrides });
    await forceAge(lead.id, ageMs);
    return lead;
  }

  it('marks a ghost past the window lost', async () => {
    const lead = await ghost();

    const expired = await store.expireGhostLeads(NOW);

    expect(expired.map((l) => l.id)).toEqual([lead.id]);
    expect(expired[0]).toMatchObject({
      status: 'lost',
      statusChangedAt: NOW.toISOString(),
    });
    expect(await store.getLead(lead.id)).toMatchObject({ status: 'lost' });
  });

  it('leaves a click inside the retention window alone', async () => {
    const lead = await ghost({}, DAY_MS - 1000);

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
    expect(await store.getLead(lead.id)).toMatchObject({
      status: 'open',
    });
  });

  it('leaves a click the owner already marked in work alone', async () => {
    const lead = await ghost();
    await store.touchLead(lead.id);

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
    expect(await store.getLead(lead.id)).toMatchObject({
      status: 'open',
    });
  });

  it('leaves a click whose contact the merge window upgraded alone', async () => {
    const lead = await store.insertLead({
      ...clickData,
      visitorId: 'v-1',
    });
    const { merged } = await store.insertOrMergeLead({
      ...baseData,
      contact: '@ivan',
      visitorId: 'v-1',
      brand: clickData.brand,
    });
    expect(merged).toBe(true);
    await forceAge(lead.id, DAY_MS + 1);

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
  });

  it('leaves a form lead with no contact alone — only clicks are ghosts', async () => {
    const lead = await store.insertLead({ ...clickData, kind: 'lead' });
    await forceAge(lead.id, DAY_MS + 1);

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
  });

  it('leaves a click the owner postponed alone', async () => {
    const lead = await ghost();
    await store.postponeLead(lead.id, '2026-10-20', 'Отложено');

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
    expect(await store.getLead(lead.id)).toMatchObject({
      status: 'postponed',
    });
  });

  it('is idempotent — a second run writes nothing at all', async () => {
    await ghost();
    await store.expireGhostLeads(NOW);
    const after = await store.readLeads();
    const writes = storage.writeAttempts();

    expect(await store.expireGhostLeads(NOW)).toEqual([]);
    expect(await store.readLeads()).toEqual(after);
    expect(storage.writeAttempts()).toBe(writes);
  });

  it('sweeps every brand in one call and returns only what it changed', async () => {
    const a = await ghost({ brand: 'Approved.rs' });
    const b = await ghost({ brand: 'CarLab' });
    const c = await ghost({ brand: 'Details' }, DAY_MS - 1000);
    const live = await store.insertLead(baseData);

    const expired = await store.expireGhostLeads(NOW);

    expect(expired.map((l) => l.id).sort()).toEqual([a.id, b.id].sort());
    expect(await store.getLead(c.id)).toMatchObject({ status: 'open' });
    expect(await store.getLead(live.id)).toMatchObject({ status: 'open' });
  });
});

describe('deleteLead', () => {
  it('permanently removes the record', async () => {
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

describe('searchLeads', () => {
  it('still finds a lost lead', async () => {
    const lead = await store.insertLead(baseData);
    await store.setStatus(lead.id, 'lost');
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
    expect(
      await store.findByPendingPrompt({ chatId: 111, messageId: 999 }),
    ).toBeUndefined();
  });

  it('findByPendingPrompt returns undefined for a chatId/messageId that does not match the pending one', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 555,
      kind: 'postpone',
    });
    expect(
      await store.findByPendingPrompt({ chatId: 111, messageId: 556 }),
    ).toBeUndefined();
    expect(
      await store.findByPendingPrompt({ chatId: 222, messageId: 555 }),
    ).toBeUndefined();
  });
});

describe('findByCard / addNote', () => {
  it('finds the Lead whose group card is the replied-to message', async () => {
    const lead = await store.insertLead(baseData);
    await store.setTelegramMessage(lead.id, -100, 555);
    expect((await store.findByCard({ chatId: -100, messageId: 555 }))?.id).toBe(
      lead.id,
    );
    expect(
      await store.findByCard({ chatId: -100, messageId: 556 }),
    ).toBeUndefined();
    expect(
      await store.findByCard({ chatId: -101, messageId: 555 }),
    ).toBeUndefined();
  });

  it('appends a note to the Lead comment', async () => {
    const lead = await store.insertLead({ ...baseData, comment: 'Звонил' });
    const noted = await store.addNote(lead.id, 'Приедет в пятницу');
    expect(noted?.comment).toBe('Звонил\nПриедет в пятницу');
    expect(await store.addNote(999, 'x')).toBeUndefined();
  });
});

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
      },
    ]);

    const [lead] = await store.readLeads();

    expect(lead.status).toBe('open');
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
        commissionPercent: 10,
        statusChangedAt: 'x',
        createdAt: 'x',
        pendingPrompt: { chatId: 1, messageId: 1, kind: 'commission_claim' },
      },
    ]);

    const [lead] = await store.readLeads();

    expect(lead).toBeDefined();
    expect(lead.status).toBe('won');
    expect(lead.pendingPrompt).toBeNull();
  });

  it('hides a record missing a required field from callers', async () => {
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
  });

  it('rejects a wrong-type value on a field that does exist, rather than coercing it', async () => {
    seedRawBlob([
      {
        id: 1,
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
        remindAt: 5000,
      },
    ]);

    expect(await store.readLeads()).toEqual([]);
    expect(storage.current()).toHaveLength(1);
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
        'updateLeads: conflict retry limit exceeded',
      );
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }

    expect(storage.writeAttempts() - before).toBe(6);
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

describe('touchLead', () => {
  it('records activity without touching the outcome', async () => {
    const lead = await store.insertLead(baseData);
    expect(lead.lastActivityAt).toBeNull();
    const at = new Date('2026-10-10T09:00:00.000Z');

    await store.touchLead(lead.id, at);

    expect(await store.getLead(lead.id)).toMatchObject({
      status: 'open',
      statusChangedAt: lead.statusChangedAt,
      lastActivityAt: at.toISOString(),
    });
  });

  it('stamps the current time by default', async () => {
    const lead = await store.insertLead(baseData);
    const updated = await store.touchLead(lead.id);
    expect(updated?.lastActivityAt).toEqual(expect.any(String));
  });
});

describe('updateLeads — failures that are not write conflicts', () => {
  it('propagates a storage failure instead of burning retries on it', async () => {
    await store.insertLead(baseData);
    const boom = new Error('storage is down');
    const failing = {
      read: storage.read,
      exists: storage.exists,
      write: vi.fn().mockRejectedValue(boom),
    };
    const brokenStore = createLeadStore({
      storage: failing,
      schema: storedLeadSchema,
    });

    await expect(brokenStore.updateLeads(() => [])).rejects.toBe(boom);
    expect(failing.write).toHaveBeenCalledTimes(1);
  });
});

describe('readLeads — a record that is not a list at all', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('refuses to read a payload that is not a list, and says which file', async () => {
    storage.seed({ oops: 'this is not a list of leads' });

    await expect(store.readLeads()).rejects.toThrow(
      /stored leads are object, not an array/,
    );
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      '[lead-crm] stored leads are not an array',
      { path: LEADS_PATH, type: 'object' },
    );
  });

  it('refuses to write over it too, rather than replacing it with a fresh list', async () => {
    storage.seed('garbage');

    await expect(store.insertLead(baseData)).rejects.toThrow(
      /refusing to overwrite/,
    );
    expect(storage.current()).toBe('garbage');
  });
});

describe('quarantine — nothing leaves the blob on its own', () => {
  const corrupt = { id: 7, name: 'Пётр', service: 'x', locale: 'ru' };

  function guarded(quarantine: (entries: unknown[]) => Promise<void>) {
    return createLeadStore({
      storage,
      schema: storedLeadSchema,
      quarantine,
    });
  }

  function seedOneGoodOneCorrupt(): void {
    storage.seed([
      {
        id: 1,
        name: 'Иван',
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'ru',
        statusChangedAt: 'x',
        createdAt: 'x',
      },
      corrupt,
    ]);
  }

  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('leaves the unreadable record in the main file after copying it out', async () => {
    const quarantine = vi.fn().mockResolvedValue(undefined);
    seedOneGoodOneCorrupt();

    await guarded(quarantine).insertLead(baseData);

    expect(quarantine).toHaveBeenCalledWith([corrupt]);
    expect(storage.current()).toContainEqual(corrupt);
  });

  it('drops a retired draft record without quarantining it', async () => {
    const quarantine = vi.fn().mockResolvedValue(undefined);
    const draft = { type: 'draft', id: 5, amount: 30 };
    storage.seed([draft]);

    await guarded(quarantine).insertLead(baseData);

    expect(quarantine).not.toHaveBeenCalled();
    expect(storage.current()).not.toContainEqual(draft);
    expect(storage.current()).toHaveLength(1);
  });

  it('keeps it when the copy fails, and says so', async () => {
    const quarantine = vi.fn().mockRejectedValue(new Error('blob down'));
    seedOneGoodOneCorrupt();

    await guarded(quarantine).insertLead(baseData);

    expect(storage.current()).toContainEqual(corrupt);
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      '[lead-crm] could not copy the unreadable records',
      expect.objectContaining({ count: 1 }),
    );
  });

  it('lands one copy and one notice across a retried write', async () => {
    const quarantineStorage = createMemoryStorage();
    const send = vi.fn().mockResolvedValue(undefined);
    const withRealQuarantine = guarded(
      createQuarantine({
        storage: quarantineStorage,
        brand: 'Test',
        getNotifier: () =>
          Promise.resolve({ notifier: { sendQuarantinedLeadsToAdmin: send } }),
      }),
    );
    seedOneGoodOneCorrupt();
    storage.failNextWrites(2);

    await withRealQuarantine.insertLead(baseData);

    expect(quarantineStorage.current()).toEqual([corrupt]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not reuse an id hiding in an unreadable record', async () => {
    storage.seed([{ id: 41, name: 'Пётр', service: 'x', locale: 'ru' }]);

    const lead = await store.insertLead(baseData);

    expect(lead.id).toBe(42);
  });

  it('reserves that id on the form path too, not just direct inserts', async () => {
    storage.seed([{ id: 41, name: 'Пётр', service: 'x', locale: 'ru' }]);

    const { lead } = await store.insertOrMergeLead({
      ...baseData,
      visitorId: 'visitor-1',
    });

    expect(lead.id).toBe(42);
  });

  it('reads an id that was stored as a string', async () => {
    storage.seed([{ id: '41', name: 'Пётр' }]);

    expect((await store.insertLead(baseData)).id).toBe(42);
  });

  it('ignores ids it cannot use rather than blocking every insert', async () => {
    storage.seed([
      { id: 'сорок один' },
      { id: 41.5 },
      { id: -3 },
      { id: Number.MAX_SAFE_INTEGER },
      { nope: true },
      null,
    ]);

    expect((await store.insertLead(baseData)).id).toBe(1);
  });

  it('leaves the quarantine alone when every record reads fine', async () => {
    const quarantine = vi.fn().mockResolvedValue(undefined);

    await guarded(quarantine).insertLead(baseData);

    expect(quarantine).not.toHaveBeenCalled();
  });
});

describe('capturePrompt', () => {
  it('holds the step a visitor is on and finds the lead by their chat id', async () => {
    const lead = await store.insertLead(baseData);

    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 777, step: 'looking_for' },
    });

    const found = await store.findByCapturePrompt(777, baseData.brand);
    expect(found?.id).toBe(lead.id);
    expect(found?.capturePrompt).toEqual({ chatId: 777, step: 'looking_for' });
  });

  it('clears the prompt when set to null', async () => {
    const lead = await store.insertLead(baseData);
    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 777, step: 'budget' },
    });

    const cleared = await store.updateCapture(lead.id, {
      capturePrompt: null,
    });

    expect(cleared?.capturePrompt).toBeNull();
    expect(
      await store.findByCapturePrompt(777, baseData.brand),
    ).toBeUndefined();
  });

  it('returns undefined for a chat id no lead is waiting on', async () => {
    const lead = await store.insertLead(baseData);
    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 777, step: 'phone' },
    });

    expect(
      await store.findByCapturePrompt(778, baseData.brand),
    ).toBeUndefined();
  });

  it('does not disturb the owner prompt on the same lead', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 555,
      kind: 'reply_visitor',
    });

    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 777, step: 'budget' },
    });

    expect(
      await store.findByPendingPrompt({ chatId: 111, messageId: 555 }),
    ).toBeDefined();
    expect(
      (await store.findByCapturePrompt(777, baseData.brand))?.pendingPrompt
        ?.kind,
    ).toBe('reply_visitor');
  });
});

describe('a capturePrompt stored before the per-brand Questionnaires', () => {
  const legacy = (id: number, step: string) => ({
    id,
    brand: baseData.brand,
    name: 'Иван',
    contact: '@ivan',
    service: '',
    locale: 'ru',
    statusChangedAt: 'x',
    createdAt: 'x',
    capturePrompt: { chatId: 700 + id, step },
  });

  it('still parses an old step and clears an unknown one without quarantining the lead', async () => {
    const quarantine = vi.fn().mockResolvedValue(undefined);
    const guarded = createLeadStore({
      storage,
      schema: storedLeadSchema,
      quarantine,
    });
    storage.seed([
      legacy(1, 'looking_for'),
      legacy(2, 'budget'),
      legacy(3, 'phone'),
      legacy(4, 'model_year'),
    ]);

    const steps = (await guarded.readLeads()).map((l) => l.capturePrompt);

    expect(quarantine).not.toHaveBeenCalled();
    expect(steps).toEqual([
      { chatId: 701, step: 'looking_for' },
      { chatId: 702, step: 'budget' },
      { chatId: 703, step: 'phone' },
      null,
    ]);
  });
});

describe('the capture lookups', () => {
  const fromTelegram = (id: number, overrides: Partial<LeadInput> = {}) =>
    store.insertLead({ ...baseData, telegramId: id, ...overrides });

  it('is the visitor merge window that decides a returning visitor', () => {
    expect(VISITOR_MERGE_WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it('finds the lead carrying the sender id', async () => {
    const lead = await fromTelegram(42);

    expect((await store.findOpenLeadByTelegramId(42, baseData.brand))?.id).toBe(
      lead.id,
    );
  });

  it('returns the newest of several leads from the same visitor', async () => {
    await fromTelegram(42);
    const second = await fromTelegram(42);

    expect((await store.findOpenLeadByTelegramId(42, baseData.brand))?.id).toBe(
      second.id,
    );
  });

  it('skips a lead with no sender id at all', async () => {
    await store.insertLead(baseData);

    expect(
      await store.findOpenLeadByTelegramId(42, baseData.brand),
    ).toBeUndefined();
  });

  it('never crosses brands, where the chat id is the same person', async () => {
    const mine = await fromTelegram(42);
    await fromTelegram(42, { brand: 'CarLab' });

    expect((await store.findOpenLeadByTelegramId(42, baseData.brand))?.id).toBe(
      mine.id,
    );
  });

  it('keeps an open dialog on another brand out of this one', async () => {
    const other = await fromTelegram(42, { brand: 'CarLab' });
    await store.updateCapture(other.id, {
      capturePrompt: { chatId: 42, step: 'budget' },
    });

    expect(await store.findByCapturePrompt(42, baseData.brand)).toBeUndefined();
  });

  it('answers with the newest open dialog on the same chat', async () => {
    const first = await fromTelegram(42);
    const second = await fromTelegram(42);
    for (const lead of [first, second])
      await store.updateCapture(lead.id, {
        capturePrompt: { chatId: 42, step: 'budget' },
      });

    expect((await store.findByCapturePrompt(42, baseData.brand))?.id).toBe(
      second.id,
    );
  });

  it.each(['won', 'lost'] as const)('skips a %s lead', async (status) => {
    const lead = await fromTelegram(42);
    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 42, step: 'budget' },
    });
    await store.setStatus(lead.id, status);

    expect(
      await store.findOpenLeadByTelegramId(42, baseData.brand),
    ).toBeUndefined();
    expect(await store.findByCapturePrompt(42, baseData.brand)).toBeUndefined();
  });

  it('keeps a lead the owner has postponed but not closed', async () => {
    const lead = await fromTelegram(42);
    await store.setStatus(lead.id, 'postponed');

    expect((await store.findOpenLeadByTelegramId(42, baseData.brand))?.id).toBe(
      lead.id,
    );
  });

  it('finds the newest number a closed lead of the same brand holds', async () => {
    await fromTelegram(42, { contact: '+381600000001' });
    const newer = await fromTelegram(42, { contact: '+381600000002' });
    await store.setStatus(newer.id, 'won');

    expect(await store.findPhoneByTelegramId(42, baseData.brand)).toBe(
      '+381600000002',
    );
  });

  it('ignores a handle, a deep link and another brand', async () => {
    await fromTelegram(42, { contact: '@ivan' });
    await fromTelegram(42, { contact: 'tg://user?id=42' });
    await fromTelegram(42, { brand: 'CarLab', contact: '+381600000003' });

    expect(
      await store.findPhoneByTelegramId(42, baseData.brand),
    ).toBeUndefined();
  });
});

describe('updateCapture', () => {
  it('marks the Lead as referred and keeps the mark on later writes', async () => {
    const lead = await store.insertLead(baseData);

    await store.updateCapture(lead.id, {
      referredBy: 'approved',
      capturePrompt: null,
    });
    const updated = await store.updateCapture(lead.id, {
      note: 'Сообщение: привет',
      capturePrompt: null,
    });

    expect(updated?.referredBy).toBe('approved');
  });

  it('switches the Lead to the locale the visitor picked', async () => {
    const lead = await store.insertLead({ ...baseData, locale: 'ru' });

    const updated = await store.updateCapture(lead.id, {
      locale: 'en',
      capturePrompt: null,
    });

    expect(updated?.locale).toBe('en');
  });

  it("makes a picked service the Lead's only one", async () => {
    const lead = await store.insertLead({
      ...baseData,
      service: 'vehicle-import',
      services: ['vehicle-import'],
    });

    const updated = await store.updateCapture(lead.id, {
      service: 'vehicle-sourcing',
      capturePrompt: { chatId: 777, step: 'looking_for' },
    });

    expect(updated).toMatchObject({
      service: 'vehicle-sourcing',
      services: ['vehicle-sourcing'],
    });
  });

  it('appends the answer and moves the dialog on in one write', async () => {
    const lead = await store.insertLead({ ...baseData, comment: 'Было' });

    const updated = await store.updateCapture(lead.id, {
      note: 'Ищет: BMW X5',
      capturePrompt: { chatId: 777, step: 'budget' },
    });

    expect(updated?.comment).toBe('Было\nИщет: BMW X5');
    expect(updated?.capturePrompt).toEqual({ chatId: 777, step: 'budget' });
  });

  it('ends the dialog without touching the comment when there is no note', async () => {
    const lead = await store.insertLead({ ...baseData, comment: 'Было' });
    await store.updateCapture(lead.id, {
      capturePrompt: { chatId: 777, step: 'budget' },
    });

    const updated = await store.updateCapture(lead.id, {
      capturePrompt: null,
    });

    expect(updated?.comment).toBe('Было');
    expect(updated?.capturePrompt).toBeNull();
  });

  it('leaves an owner edit made mid-dialog in place', async () => {
    const lead = await store.insertLead(baseData);
    await store.setPendingPrompt(lead.id, {
      chatId: 111,
      messageId: 555,
      kind: 'reply_visitor',
    });

    const updated = await store.updateCapture(lead.id, {
      note: 'Бюджет: 20000',
      capturePrompt: null,
    });

    expect(updated?.pendingPrompt?.kind).toBe('reply_visitor');
  });

  it('replaces the contact when the visitor shares a better one', async () => {
    const lead = await store.insertLead({
      ...baseData,
      contact: 'tg://user?id=42',
    });

    const updated = await store.updateCapture(lead.id, {
      contact: '+381601234567',
      capturePrompt: null,
    });

    expect(updated?.contact).toBe('+381601234567');
  });

  it('returns undefined for an id that does not exist', async () => {
    expect(
      await store.updateCapture(999, { capturePrompt: null }),
    ).toBeUndefined();
  });
});
