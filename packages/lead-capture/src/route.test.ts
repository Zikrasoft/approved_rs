import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LeadInput, StoredLead } from '@podbor/lead-crm';
import { createCaptureWebhookRoute } from './route.ts';

const SECRET = 'capture-webhook-secret';
const BRAND = 'Approved.rs';
const SERVICES = ['vehicle-sourcing', 'vehicle-import'];
const LOCALES = ['ru', 'en', 'sr', 'es', 'de'];

function storedLead(data: LeadInput, id: number): StoredLead {
  const now = new Date().toISOString();
  return {
    id,
    brand: data.brand,
    name: data.name,
    contact: data.contact,
    service: data.service,
    services: data.services ?? [],
    contactChannel: data.contactChannel,
    comment: data.comment,
    country: data.country,
    source_url: data.source_url,
    visitorId: data.visitorId,
    locale: data.locale,
    kind: data.kind,
    status: 'new',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    incomes: [],
    telegramChatId: null,
    telegramMessageId: null,
    statusChangedAt: now,
    createdAt: now,
    pendingPrompt: null,
    capturePrompt: null,
    archived: false,
    pendingCommissionClaim: null,
    remindAt: null,
    postponedFrom: null,
  };
}

function makeStore() {
  const leads: StoredLead[] = [];
  return {
    leads,
    insertLead: vi.fn(async (data: LeadInput) => {
      const lead = storedLead(data, leads.length + 1);
      leads.push(lead);
      return lead;
    }),
  };
}

let store: ReturnType<typeof makeStore>;
let ensureLeadCard: ReturnType<typeof vi.fn>;
let POST: ReturnType<typeof createCaptureWebhookRoute>;

function route(secret: string | undefined) {
  return createCaptureWebhookRoute({
    secret,
    store,
    ensureLeadCard,
    brand: BRAND,
    isService: (value) => SERVICES.includes(value),
    isLocale: (value) => LOCALES.includes(value),
    primaryLocale: 'ru',
  });
}

function makeCtx(
  body: unknown,
  headers: Record<string, string> = {
    'x-telegram-bot-api-secret-token': SECRET,
  },
) {
  return {
    request: new Request('http://localhost/api/telegram-capture', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  };
}

const ANONYMOUS = { id: 777, first_name: 'Лена' };
const HANDLED = {
  id: 42,
  first_name: 'Иван',
  last_name: 'Петров',
  username: 'ivan',
};

function startUpdate(
  payload?: string,
  from: Record<string, unknown> = HANDLED,
  chatType = 'private',
) {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      chat: { id: from.id, type: chatType },
      from,
      text: payload ? `/start ${payload}` : '/start',
    },
  };
}

beforeEach(() => {
  store = makeStore();
  ensureLeadCard = vi.fn(async () => {});
  POST = route(SECRET);
});

describe('the webhook secret', () => {
  it('rejects an update whose secret header does not match', async () => {
    const res = await POST(
      makeCtx(startUpdate(), { 'x-telegram-bot-api-secret-token': 'nope' }),
    );
    expect(res.status).toBe(401);
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('rejects every update when no secret is configured', async () => {
    const res = await route(undefined)(makeCtx(startUpdate()));
    expect(res.status).toBe(401);
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('acknowledges an update that carries the right secret', async () => {
    const res = await POST(makeCtx(startUpdate()));
    expect(res.status).toBe(200);
  });
});

describe('updates that are not a visitor pressing Start', () => {
  it('acknowledges a malformed body without storing anything', async () => {
    const res = await POST(makeCtx('not json'));
    expect(res.status).toBe(200);
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('acknowledges an update with no message', async () => {
    await POST(makeCtx({ update_id: 2, callback_query: { id: 'x' } }));
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('acknowledges a message that is missing a sender', async () => {
    await POST(
      makeCtx({
        message: { chat: { id: 1, type: 'private' }, text: '/start' },
      }),
    );
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('ignores chatter in a group chat', async () => {
    await POST(makeCtx(startUpdate(undefined, HANDLED, 'supergroup')));
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('ignores a message with no text at all', async () => {
    await POST(
      makeCtx({
        message: { chat: { id: 42, type: 'private' }, from: HANDLED },
      }),
    );
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('ignores a message that is not /start', async () => {
    const update = startUpdate();
    update.message.text = 'здравствуйте';
    await POST(makeCtx(update));
    expect(store.insertLead).not.toHaveBeenCalled();
  });

  it('acknowledges even when the store throws', async () => {
    store.insertLead.mockRejectedValueOnce(new Error('blob is down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeCtx(startUpdate()));
    expect(res.status).toBe(200);
    expect(ensureLeadCard).not.toHaveBeenCalled();
  });
});

describe('the Lead written at /start', () => {
  it('puts a card in front of the operator with the contact already on it', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_sr')));
    expect(ensureLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, contact: '@ivan' }),
    );
  });

  it('takes the @username as the contact, and the full name', async () => {
    await POST(makeCtx(startUpdate('ru')));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: '@ivan',
        name: 'Иван Петров',
        contactChannel: 'telegram',
        kind: 'lead',
        source_url: null,
        visitorId: null,
      }),
    );
  });

  it('falls back to a tg://user link when the sender has no username', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ contact: 'tg://user?id=777', name: 'Лена' }),
    );
  });

  it('stores an empty name when the sender has none', async () => {
    await POST(makeCtx(startUpdate('ru', { id: 9 })));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: '' }),
    );
  });

  it('records the sender id so the visitor can be found again', async () => {
    await POST(makeCtx(startUpdate('ru')));
    expect(store.leads[0].comment).toBe('Telegram id: 42');
  });

  it('stamps the bot owner brand, whatever the payload says', async () => {
    await POST(makeCtx(startUpdate('CarLab_sr')));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ brand: BRAND }),
    );
  });
});

describe('the deep-link payload', () => {
  it('takes the service and the locale the page was in', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_de')));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'vehicle-import',
        services: ['vehicle-import'],
        locale: 'de',
      }),
    );
  });

  it('carries the locale alone when the page had no service', async () => {
    await POST(makeCtx(startUpdate('es')));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ service: '', services: [], locale: 'es' }),
    );
  });

  it('drops a service it does not recognise but keeps the locale', async () => {
    await POST(makeCtx(startUpdate('wheel-polishing_en')));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ service: '', locale: 'en' }),
    );
  });

  it('falls back to the client language when the locale is unknown', async () => {
    await POST(
      makeCtx(
        startUpdate('vehicle-sourcing_fr', { ...HANDLED, language_code: 'en' }),
      ),
    );
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ service: 'vehicle-sourcing', locale: 'en' }),
    );
  });

  it('falls back to the primary locale when nothing else is usable', async () => {
    await POST(
      makeCtx(startUpdate(undefined, { ...HANDLED, language_code: 'fr' })),
    );
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'ru' }),
    );
  });

  it('never rejects a visitor over a hostile payload', async () => {
    await POST(makeCtx(startUpdate('<script>_'.repeat(20))));
    expect(store.insertLead).toHaveBeenCalledWith(
      expect.objectContaining({ service: '', locale: 'ru' }),
    );
  });
});
