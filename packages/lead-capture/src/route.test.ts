import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CaptureUpdate, LeadInput, StoredLead } from '@podbor/lead-crm';
import { createCaptureWebhookRoute } from './route.ts';

const SECRET = 'capture-webhook-secret';
const BRAND = 'Approved.rs';
const SERVICES = ['vehicle-sourcing', 'vehicle-import'];
const LOCALES = ['ru', 'en', 'sr', 'es', 'de'];
type TestLocale = (typeof LOCALES)[number];

const COPY = {
  greeting: 'GREETING',
  lookingFor: 'LOOKING_FOR',
  budget: 'BUDGET',
  phoneAsk: 'PHONE_ASK',
  phoneOffer: 'PHONE_OFFER',
  phoneButton: 'SHARE_NUMBER',
  phoneSkip: 'SKIP',
  thanks: 'THANKS',
  received: 'RECEIVED',
};

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
    capturePrompt: data.capturePrompt ?? null,
    archived: false,
    pendingCommissionClaim: null,
    remindAt: null,
    postponedFrom: null,
  };
}

function makeStore() {
  const leads: StoredLead[] = [];
  const patch = (lead: StoredLead, next: StoredLead) => {
    leads[leads.indexOf(lead)] = next;
    return next;
  };
  return {
    leads,
    insertLead: vi.fn(async (data: LeadInput) => {
      const lead = storedLead(data, leads.length + 1);
      leads.push(lead);
      return lead;
    }),
    findByCapturePrompt: vi.fn(async (chatId: number) =>
      leads.find((l) => l.capturePrompt?.chatId === chatId),
    ),
    findOpenLeadByTelegramId: vi.fn(async (telegramId: number) =>
      leads
        .filter(
          (l) =>
            !l.archived &&
            l.status !== 'won' &&
            l.status !== 'lost' &&
            (l.comment ?? '')
              .split('\n')
              .includes(`Telegram id: ${telegramId}`),
        )
        .at(-1),
    ),
    updateCapture: vi.fn(
      async (id: number, { note, contact, capturePrompt }: CaptureUpdate) => {
        const lead = leads.find((l) => l.id === id);
        if (!lead) return undefined;
        return patch(lead, {
          ...lead,
          comment: note ? `${lead.comment ?? ''}\n${note}` : lead.comment,
          contact: contact ?? lead.contact,
          capturePrompt,
        });
      },
    ),
  };
}

let store: ReturnType<typeof makeStore>;
let ensureLeadCard: ReturnType<typeof vi.fn>;
let bot: { sendMessage: ReturnType<typeof vi.fn> };
let POST: ReturnType<typeof createCaptureWebhookRoute>;

function route(secret: string | undefined) {
  return createCaptureWebhookRoute({
    secret,
    store,
    ensureLeadCard,
    bot,
    brand: BRAND,
    isService: (value) => SERVICES.includes(value),
    isLocale: (value): value is TestLocale => LOCALES.includes(value),
    primaryLocale: 'ru',
    copy: (locale) => ({ ...COPY, greeting: `GREETING_${locale}` }),
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

function textUpdate(text: string, from: Record<string, unknown> = HANDLED) {
  return {
    update_id: 2,
    message: {
      message_id: 11,
      chat: { id: from.id, type: 'private' },
      from,
      text,
    },
  };
}

async function say(text: string, from: Record<string, unknown> = HANDLED) {
  await POST(makeCtx(textUpdate(text, from)));
}

function lastSent(): [number, string] {
  const calls = bot.sendMessage.mock.calls;
  return (calls[calls.length - 1] as [number, string, unknown]).slice(0, 2) as [
    number,
    string,
  ];
}

function lastExtra(): Record<string, unknown> | undefined {
  const calls = bot.sendMessage.mock.calls;
  return calls[calls.length - 1][2] as Record<string, unknown> | undefined;
}

function contactUpdate(
  phoneNumber: string,
  from: Record<string, unknown> = ANONYMOUS,
) {
  return {
    update_id: 3,
    message: {
      message_id: 12,
      chat: { id: from.id, type: 'private' },
      from,
      contact: { phone_number: phoneNumber, user_id: from.id },
    },
  };
}

beforeEach(() => {
  store = makeStore();
  ensureLeadCard = vi.fn(async () => {});
  bot = { sendMessage: vi.fn(async () => {}) };
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

describe('the two questions', () => {
  it('greets and asks what the visitor is looking for, in the page locale', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_sr')));

    expect(bot.sendMessage).toHaveBeenCalledTimes(1);
    expect(lastSent()).toEqual([42, 'GREETING_sr\n\nLOOKING_FOR']);
  });

  it('puts the first answer on the card and asks for the budget', async () => {
    await POST(makeCtx(startUpdate('ru')));
    ensureLeadCard.mockClear();

    await say('BMW X5, не старше 2018');

    expect(store.leads[0].comment).toContain('Ищет: BMW X5, не старше 2018');
    expect(ensureLeadCard).toHaveBeenCalledTimes(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('puts the budget on the card too', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    await say('до 20 000 евро');

    expect(store.leads[0].comment).toContain('Бюджет: до 20 000 евро');
  });

  it('answers in the locale the Lead was created in', async () => {
    await POST(makeCtx(startUpdate('de')));

    await say('ein Kombi');

    expect(lastSent()).toEqual([42, 'BUDGET']);
    expect(store.leads[0].locale).toBe('de');
  });
});

describe('a Lead that disappears mid-dialog', () => {
  it('still refreshes the card and keeps the conversation going', async () => {
    await POST(makeCtx(startUpdate('ru')));
    store.updateCapture.mockResolvedValueOnce(undefined);

    await say('BMW X5');

    expect(ensureLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });
});

describe('abandoning the dialog', () => {
  it('leaves the contact and the card intact after the first question', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_ru', ANONYMOUS)));

    expect(store.leads[0]).toMatchObject({
      contact: 'tg://user?id=777',
      service: 'vehicle-sourcing',
      status: 'new',
      archived: false,
    });
    expect(ensureLeadCard).toHaveBeenCalledTimes(1);
  });

  it('leaves the contact intact after the second question', async () => {
    await POST(makeCtx(startUpdate('ru')));

    await say('BMW X5');

    expect(store.leads[0]).toMatchObject({
      contact: '@ivan',
      capturePrompt: { chatId: 42, step: 'budget' },
    });
  });
});

describe('an operator editing the same Lead mid-dialog', () => {
  it('neither side overwrites the other', async () => {
    await POST(makeCtx(startUpdate('ru')));
    store.leads[0] = {
      ...store.leads[0],
      name: 'Иван Петрович',
      pendingPrompt: { chatId: 111, messageId: 555, kind: 'edit_name' },
    };

    await say('BMW X5');

    expect(store.leads[0].name).toBe('Иван Петрович');
    expect(store.leads[0].pendingPrompt?.kind).toBe('edit_name');
    expect(store.leads[0].comment).toContain('Ищет: BMW X5');
    expect(store.leads[0].capturePrompt?.step).toBe('budget');
  });
});

describe('the phone, asked first when nothing else can reach the visitor', () => {
  it('asks for the number through a share-contact button before anything else', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(lastSent()).toEqual([777, 'GREETING_ru\n\nPHONE_ASK']);
    expect(lastExtra()).toEqual({
      reply_markup: {
        keyboard: [
          [{ text: 'SHARE_NUMBER', request_contact: true }],
          [{ text: 'SKIP' }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  });

  it('makes the shared number the contact, ahead of the tg://user fallback', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(store.leads[0].contact).toBe('+381601234567');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
    expect(lastExtra()).toEqual({ reply_markup: { remove_keyboard: true } });
  });

  it('keeps a number that already carries its plus sign', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await POST(makeCtx(contactUpdate('+381601234567')));

    expect(store.leads[0].contact).toBe('+381601234567');
  });

  it('carries on through the questions after the number', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await POST(makeCtx(contactUpdate('381601234567')));

    await say('Golf 7', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'BUDGET']);

    await say('10 000', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'THANKS']);
    expect(store.leads[0].capturePrompt).toBeNull();
  });

  it('moves on when the visitor declines, keeping the Lead reachable by bot', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await say('SKIP', ANONYMOUS);

    expect(store.leads[0].contact).toBe('tg://user?id=777');
    expect(store.leads[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
  });
});

describe('the phone, offered last when the visitor has a handle', () => {
  it('comes after both questions, as a call offer', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    await say('20 000');

    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(store.leads[0].capturePrompt?.step).toBe('phone');
  });

  it('puts a shared number in the comment and leaves the handle as the contact', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(store.leads[0].contact).toBe('@ivan');
    expect(store.leads[0].comment).toContain('Телефон: +381601234567');
    expect(store.leads[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(lastExtra()).toEqual({ reply_markup: { remove_keyboard: true } });
  });

  it('ends the dialog intact when the visitor declines the call', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');

    await say('SKIP');

    expect(store.leads[0].contact).toBe('@ivan');
    expect(store.leads[0].comment).not.toContain('Телефон');
    expect(store.leads[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'THANKS']);
  });
});

describe('a contact shared outside the phone step', () => {
  it('is ignored while another question is open', async () => {
    await POST(makeCtx(startUpdate('ru')));
    bot.sendMessage.mockClear();

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(store.leads[0].capturePrompt?.step).toBe('looking_for');
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });

  it('is ignored when the visitor has no dialog open at all', async () => {
    await POST(makeCtx(contactUpdate('381601234567')));

    expect(store.insertLead).not.toHaveBeenCalled();
    expect(bot.sendMessage).not.toHaveBeenCalled();
  });
});

describe('a visitor who presses Start again', () => {
  const HOUR = 60 * 60 * 1000;

  it('continues the open Lead within the hour instead of capturing again', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    store.insertLead.mockClear();

    await POST(makeCtx(startUpdate('ru')));

    expect(store.insertLead).not.toHaveBeenCalled();
    expect(store.leads).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('says nothing new when the dialog it rejoins is already done', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');

    await POST(makeCtx(startUpdate('ru')));

    expect(store.leads).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'THANKS']);
  });

  it('starts a fresh enquiry once the hour has passed', async () => {
    await POST(makeCtx(startUpdate('ru')));
    store.leads[0] = {
      ...store.leads[0],
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
    };

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(store.leads).toHaveLength(2);
    expect(store.leads[1].service).toBe('vehicle-import');
    expect(lastSent()).toEqual([42, 'GREETING_en\n\nLOOKING_FOR']);
  });

  it('skips the greeting and brings the share-contact keyboard back', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    bot.sendMessage.mockClear();

    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(store.leads).toHaveLength(1);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastExtra()).toHaveProperty('reply_markup.keyboard');
  });
});

describe('free text outside the dialog', () => {
  it('lands on the open Lead and refreshes the card', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    ensureLeadCard.mockClear();

    await say('а можно в рассрочку?');

    expect(store.leads).toHaveLength(1);
    expect(store.leads[0].comment).toContain('Сообщение: а можно в рассрочку?');
    expect(ensureLeadCard).toHaveBeenCalledTimes(1);
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('leaves a dialog that is still running alone', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    expect(store.leads[0].comment).not.toContain('Сообщение');
    expect(store.leads[0].capturePrompt?.step).toBe('budget');
  });

  it('opens a new enquiry when the visitor has no open Lead', async () => {
    await say('привет, ищу машину');

    expect(store.insertLead).toHaveBeenCalledTimes(1);
    expect(store.leads[0].comment).toBe(
      'Telegram id: 42\nСообщение: привет, ищу машину',
    );
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nLOOKING_FOR']);
  });

  it('opens a new enquiry when the only Lead is archived', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    store.leads[0] = { ...store.leads[0], archived: true };

    await say('я вернулся');

    expect(store.leads).toHaveLength(2);
  });

  it('still records the message when the Lead vanishes mid-write', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    store.updateCapture.mockResolvedValueOnce(undefined);

    await say('ещё вопрос');

    expect(ensureLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });
});
