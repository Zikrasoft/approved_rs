import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrandBot,
  createBrandStore,
  createTelegramClient,
  LEADS_PATH,
  type LeadInput,
  type LeadStore,
  type StoredLead,
} from '@podbor/lead-crm';
import {
  createMemoryStorage,
  recordBotApi,
  type MemoryStorage,
  type RecordedBotApi,
} from '@podbor/lead-crm/testing';

import { stampStartVisitor } from '@podbor/site-kit/contact-links';

import { referralLink } from './menu.ts';
import { captureStore, createCaptureWebhookRoute } from './route.ts';

const SECRET = 'capture-webhook-secret';
const CAPTURE_TOKEN = 'capture-token';
const CRM_TOKEN = 'crm-token';
const GROUP_ID = '-100500';
const ADMIN_IDS = [501, 502];
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
  menu: { text: 'MENU', back: 'BACK' },
  services: { button: 'SERVICES', text: 'PICK_A_SERVICE' },
  card: { request: 'LEAVE_A_REQUEST', site: 'ON_THE_SITE' },
  contacts: { button: 'CONTACTS', text: 'REACH_US', hours: 'HOURS' },
  manager: { button: 'MANAGER', text: 'WRITE_YOUR_QUESTION' },
  partners: { button: 'PARTNERS', text: 'PICK_A_PARTNER' },
  request: { button: 'REQUEST', car: 'CAR', service: 'WHICH_SERVICE' },
};

const WORKSHOP = {
  title: 'CarLab',
  street: 'Jovana Ćirilova 23a',
  city: 'Beograd',
  lat: 44.8054581,
  lon: 20.4858424,
};

const MENU_KEYBOARD = {
  inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:ru' }]],
};

let api: RecordedBotApi;
let storage: MemoryStorage;
let leadStore: LeadStore;
let ensureLeadCard: (lead: StoredLead) => Promise<void>;
let notifier: ReturnType<typeof createBrandBot>['notifier'];
let POST: ReturnType<typeof createCaptureWebhookRoute>;

type RouteOptions = Parameters<
  typeof createCaptureWebhookRoute<string, string>
>[0];

function route(
  secret: string | undefined,
  overrides: Partial<RouteOptions> = {},
) {
  return createCaptureWebhookRoute({
    contacts: { phone: '381601234567', site: 'https://example.test' },
    secret,
    store: captureStore(leadStore),
    ensureLeadCard,
    sendFieldChangeToAdmin: notifier.sendFieldChangeToAdmin,
    bot: createTelegramClient(CAPTURE_TOKEN, 'capture_bot').bot,
    brand: BRAND,
    isLocale: (value): value is TestLocale => LOCALES.includes(value),
    primaryLocale: 'ru',
    copy: (locale) => ({ ...COPY, greeting: `GREETING_${locale}` }),
    menu: ['services'],
    services: SERVICES,
    serviceCard: (slug, locale) => ({
      title: `CARD_${slug}_${locale}`,
      lines: ['ABOUT <it>', '', 'FROM 100 €'],
      url: `https://example.test/${locale}/${slug}/`,
    }),
    questionnaire: ['looking_for', 'budget', 'phone'],
    ...overrides,
  });
}

function stored(): StoredLead[] {
  return (storage.current() ?? []) as StoredLead[];
}

function editLead(id: number, patch: Partial<StoredLead>) {
  storage.seed(stored().map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

function vanishOnNextWrite() {
  storage.failNextWrites(1, () => storage.seed([]));
}

function replies() {
  return api.callsTo('sendMessage', CAPTURE_TOKEN).map((c) => c.payload);
}

function lastSent(): [unknown, unknown] {
  const last = replies().at(-1);
  return [last?.chat_id, last?.text];
}

function lastMarkup(): unknown {
  return replies().at(-1)?.reply_markup;
}

function cards() {
  return api
    .callsTo('sendMessage', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => p.chat_id === GROUP_ID);
}

function adminNotes(chatId = ADMIN_IDS[0]) {
  return api
    .callsTo('sendMessage', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => p.chat_id === chatId)
    .map((p) => String(p.text));
}

function cardEdits() {
  return api.callsTo('editMessageText', CRM_TOKEN).map((c) => c.payload);
}

function sisterLead(): LeadInput {
  return {
    brand: 'CarLab',
    name: 'Иван Петров',
    contact: '@ivan',
    service: '',
    locale: 'ru',
    comment: null,
    country: null,
    source_url: null,
    visitorId: null,
    contactChannel: 'telegram',
    kind: 'lead',
    telegramId: 42,
    capturePrompt: { chatId: 42, step: 'looking_for' },
  };
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

function tapUpdate(data: string, from: Record<string, unknown> = HANDLED) {
  return {
    update_id: 4,
    callback_query: {
      id: 'tap-1',
      from,
      chat_instance: 'instance',
      data,
      message: {
        message_id: 900,
        date: 0,
        chat: { id: from.id, type: 'private' },
        text: 'MENU',
      },
    },
  };
}

async function tap(data: string, from: Record<string, unknown> = HANDLED) {
  await POST(makeCtx(tapUpdate(data, from)));
}

async function begin(
  payload = 'vehicle-sourcing_ru',
  from: Record<string, unknown> = HANDLED,
) {
  await POST(makeCtx(startUpdate(payload, from)));
  const [service, locale] = payload.split('_');
  await tap(`request:${locale}:${service}`, from);
}

function edits() {
  return api.callsTo('editMessageText', CAPTURE_TOKEN).map((c) => c.payload);
}

async function say(text: string, from: Record<string, unknown> = HANDLED) {
  await POST(makeCtx(textUpdate(text, from)));
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
  vi.stubEnv('TELEGRAM_BOT_TOKEN', CRM_TOKEN);
  vi.stubEnv('TELEGRAM_BOT_USERNAME', 'crm_bot');
  vi.stubEnv('TELEGRAM_GROUP_ID', GROUP_ID);
  vi.stubEnv('TELEGRAM_ADMIN_ID', ADMIN_IDS.join(','));
  api = recordBotApi();
  vi.stubGlobal('fetch', api.fetch);
  const storages: Record<string, MemoryStorage> = {};
  ({ leadStore } = createBrandStore({
    brand: BRAND,
    commissionPercent: 10,
    storageFor: (path) => (storages[path] = createMemoryStorage()),
    getNotifier: vi.fn(),
  }));
  storage = storages[LEADS_PATH];
  ({ ensureLeadCard, notifier } = createBrandBot({
    store: leadStore,
    brand: BRAND,
    serviceLabel: (slug) => slug,
  }));
  POST = route(SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the webhook secret', () => {
  it('rejects an update whose secret header does not match', async () => {
    const res = await POST(
      makeCtx(startUpdate(), { 'x-telegram-bot-api-secret-token': 'nope' }),
    );
    expect(res.status).toBe(401);
    expect(stored()).toHaveLength(0);
  });

  it('rejects every update when no secret is configured', async () => {
    const res = await route(undefined)(makeCtx(startUpdate()));
    expect(res.status).toBe(401);
    expect(stored()).toHaveLength(0);
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
    expect(stored()).toHaveLength(0);
  });

  it('acknowledges a body that is not an update object', async () => {
    const res = await POST(makeCtx('null'));
    expect(res.status).toBe(200);
    expect(stored()).toHaveLength(0);
  });

  it('acknowledges an update with no message', async () => {
    await POST(makeCtx({ update_id: 2, callback_query: { id: 'x' } }));
    expect(stored()).toHaveLength(0);
  });

  it('acknowledges a message that is missing a sender', async () => {
    await POST(
      makeCtx({
        message: { chat: { id: 1, type: 'private' }, text: '/start' },
      }),
    );
    expect(stored()).toHaveLength(0);
  });

  it('ignores chatter in a group chat', async () => {
    await POST(makeCtx(startUpdate(undefined, HANDLED, 'supergroup')));
    expect(stored()).toHaveLength(0);
  });

  it('ignores a message with no text at all', async () => {
    await POST(
      makeCtx({
        message: { chat: { id: 42, type: 'private' }, from: HANDLED },
      }),
    );
    expect(stored()).toHaveLength(0);
  });

  it('acknowledges even when the store throws', async () => {
    vi.spyOn(storage, 'read').mockRejectedValueOnce(new Error('blob is down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeCtx(startUpdate()));
    expect(res.status).toBe(200);
    expect(cards()).toHaveLength(0);
    expect(replies()).toHaveLength(0);
  });
});

describe('the Lead written at /start', () => {
  it('puts a card in front of the operator with the contact already on it', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_sr')));
    expect(cards()).toEqual([
      expect.objectContaining({
        chat_id: GROUP_ID,
        text: expect.stringContaining('Заявка #1'),
      }),
    ]);
    expect(stored()[0]).toMatchObject({ id: 1, contact: '@ivan' });
  });

  it('takes the @username as the contact, and the full name', async () => {
    await POST(makeCtx(startUpdate('ru')));
    expect(stored()[0]).toMatchObject({
      contact: '@ivan',
      name: 'Иван Петров',
      contactChannel: 'telegram',
      kind: 'lead',
      source_url: null,
      visitorId: null,
    });
  });

  it('takes the visitor id the site tile stamped on the start payload', async () => {
    await POST(
      makeCtx(
        startUpdate('vehicle-import_sr_0f8fad5bd9cb469fa16570867728950e'),
      ),
    );
    expect(stored()[0]).toMatchObject({
      visitorId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      service: 'vehicle-import',
      locale: 'sr',
    });
  });

  it('falls back to a tg://user link when the sender has no username', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    expect(stored()[0]).toMatchObject({
      contact: 'tg://user?id=777',
      name: 'Лена',
    });
  });

  it('stores an empty name when the sender has none', async () => {
    await POST(makeCtx(startUpdate('ru', { id: 9 })));
    expect(stored()[0]).toMatchObject({ name: '' });
  });

  it('records the sender id so the visitor can be found again', async () => {
    await POST(makeCtx(startUpdate('ru')));
    expect(stored()[0].telegramId).toBe(42);
  });

  it('stamps the bot owner brand, whatever the payload says', async () => {
    await POST(makeCtx(startUpdate('CarLab_sr')));
    expect(stored()[0]).toMatchObject({ brand: BRAND });
  });
});

describe('the deep-link payload', () => {
  it('takes the service and the locale the page was in', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_de')));
    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import'],
      locale: 'de',
    });
  });

  it('carries the locale alone when the page had no service', async () => {
    await POST(makeCtx(startUpdate('es')));
    expect(stored()[0]).toMatchObject({
      service: '',
      services: [],
      locale: 'es',
    });
  });

  it('drops a service it does not recognise but keeps the locale', async () => {
    await POST(makeCtx(startUpdate('wheel-polishing_en')));
    expect(stored()[0]).toMatchObject({ service: '', locale: 'en' });
  });

  it('falls back to the client language when the locale is unknown', async () => {
    await POST(
      makeCtx(
        startUpdate('vehicle-sourcing_fr', { ...HANDLED, language_code: 'en' }),
      ),
    );
    expect(stored()[0]).toMatchObject({
      service: 'vehicle-sourcing',
      locale: 'en',
    });
  });

  it('falls back to the primary locale when nothing else is usable', async () => {
    await POST(
      makeCtx(startUpdate(undefined, { ...HANDLED, language_code: 'fr' })),
    );
    expect(stored()[0]).toMatchObject({ locale: 'ru' });
  });

  it('never rejects a visitor over a hostile payload', async () => {
    await POST(makeCtx(startUpdate('<script>_'.repeat(20))));
    expect(stored()[0]).toMatchObject({ service: '', locale: 'ru' });
  });
});

describe('the screen /start opens', () => {
  it('greets a cold visitor with the main menu', async () => {
    await POST(makeCtx(startUpdate()));

    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nMENU']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
    expect(stored()[0].capturePrompt).toBeNull();
  });

  it('opens the card of the service the tile named, in its language', async () => {
    await POST(
      makeCtx(
        startUpdate('vehicle-import_sr_0f8fad5bd9cb469fa16570867728950e'),
      ),
    );

    expect(lastSent()).toEqual([
      42,
      [
        'GREETING_sr',
        '',
        '<b>CARD_vehicle-import_sr</b>',
        '',
        'ABOUT &lt;it&gt;',
        '',
        'FROM 100 €',
      ].join('\n'),
    ]);
    expect(lastMarkup()).toEqual({
      inline_keyboard: [
        [
          {
            text: 'LEAVE_A_REQUEST',
            callback_data: 'request:sr:vehicle-import',
          },
        ],
        [
          {
            text: 'ON_THE_SITE',
            url: 'https://example.test/sr/vehicle-import/',
          },
        ],
        [{ text: 'BACK', callback_data: 'services:sr' }],
      ],
    });
  });

  it('still creates the Lead with the service on it', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_sr')));

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      locale: 'sr',
      capturePrompt: null,
    });
    expect(cards()).toHaveLength(1);
  });
});

describe('browsing the menu', () => {
  it('lists every service on the Services screen, in place', async () => {
    await POST(makeCtx(startUpdate('en')));
    api.reset();

    await tap('services:en');

    expect(api.callsTo('answerCallbackQuery', CAPTURE_TOKEN)).toHaveLength(1);
    expect(edits()).toEqual([
      expect.objectContaining({
        chat_id: 42,
        message_id: 900,
        text: 'PICK_A_SERVICE',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'CARD_vehicle-sourcing_en',
                callback_data: 'service:en:vehicle-sourcing',
              },
            ],
            [
              {
                text: 'CARD_vehicle-import_en',
                callback_data: 'service:en:vehicle-import',
              },
            ],
            [{ text: 'BACK', callback_data: 'menu:en' }],
          ],
        },
      }),
    ]);
    expect(replies()).toHaveLength(0);
  });

  it('opens a card and goes back to the menu, writing nothing', async () => {
    await POST(makeCtx(startUpdate('de')));
    const writes = storage.writeAttempts();

    await tap('service:de:vehicle-sourcing');
    expect(edits().at(-1)?.text).toContain('<b>CARD_vehicle-sourcing_de</b>');

    await tap('menu:de');
    expect(edits().at(-1)).toMatchObject({
      text: 'MENU',
      reply_markup: {
        inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:de' }]],
      },
    });
    expect(storage.writeAttempts()).toBe(writes);
  });

  it('works for a visitor who never pressed Start', async () => {
    await tap('services:ru');

    expect(edits()).toHaveLength(1);
    expect(stored()).toHaveLength(0);
  });

  it('falls back to the primary locale for a locale the site does not serve', async () => {
    await tap('services:fr');

    expect(edits()[0].reply_markup).toMatchObject({
      inline_keyboard: expect.arrayContaining([
        [{ text: 'BACK', callback_data: 'menu:ru' }],
      ]),
    });
  });

  it.each([
    'service:ru:wheel-polishing',
    'request:ru:wheel-polishing',
    'nowhere:ru',
    'hasOwnProperty:ru',
    'services',
    'services:ru:a:b',
    'SERVICES:RU',
  ])('only acknowledges a tap it cannot read: %s', async (data) => {
    await tap(data);

    expect(api.callsTo('answerCallbackQuery', CAPTURE_TOKEN)).toHaveLength(1);
    expect(edits()).toHaveLength(0);
    expect(replies()).toHaveLength(0);
    expect(stored()).toHaveLength(0);
  });

  it('only acknowledges a tap it cannot trace back to a visitor', async () => {
    await POST(
      makeCtx({
        update_id: 6,
        callback_query: {
          id: 'tap-3',
          from: { first_name: 'no id' },
          chat_instance: 'instance',
          data: 'services:ru',
          message: {
            message_id: 900,
            date: 0,
            chat: { id: 42, type: 'private' },
          },
        },
      }),
    );

    expect(api.callsTo('answerCallbackQuery', CAPTURE_TOKEN)).toHaveLength(1);
    expect(edits()).toHaveLength(0);
  });

  it('keeps every button under the 64-byte callback limit', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_de')));
    await tap('services:de');

    const markups = [
      ...replies().map((p) => p.reply_markup),
      ...edits().map((p) => p.reply_markup),
    ] as { inline_keyboard: { callback_data?: string }[][] }[];
    const data = markups.flatMap((m) =>
      m.inline_keyboard.flat().flatMap((b) => b.callback_data ?? []),
    );
    expect(data.length).toBeGreaterThan(0);
    for (const d of data)
      expect(new TextEncoder().encode(d).length).toBeLessThanOrEqual(64);
  });
});

describe('leaving a request from a service card', () => {
  it('sets the service, tells the admin and asks the first question', async () => {
    await POST(makeCtx(startUpdate('sr')));
    api.reset();

    await tap('request:sr:vehicle-import');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import'],
      capturePrompt: { chatId: 42, step: 'looking_for' },
    });
    for (const id of ADMIN_IDS)
      expect(adminNotes(id)).toEqual([
        [
          '✏️ Заявка #1 Иван Петров: услуга',
          '🤖 Посетитель через бота',
          '',
          'Было: —',
          'Стало: vehicle-import',
        ].join('\n'),
      ]);
    expect(cardEdits()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);
  });

  it('asks for the phone first when nothing else reaches the visitor', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_ru', ANONYMOUS)));

    await tap('request:ru:vehicle-import', ANONYMOUS);

    expect(adminNotes()).toEqual([]);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toHaveProperty('keyboard');
  });

  it('opens a Lead when the visitor has none open', async () => {
    await tap('request:en:vehicle-sourcing');

    expect(stored()).toEqual([
      expect.objectContaining({
        brand: BRAND,
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'en',
        capturePrompt: { chatId: 42, step: 'looking_for' },
      }),
    ]);
    expect(cards()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);
  });

  it('opens a Lead with the phone the visitor gave before', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    editLead(1, { status: 'won' });

    await tap('request:ru:vehicle-import', ANONYMOUS);

    expect(stored()[1]).toMatchObject({
      contact: '+381601234567',
      capturePrompt: { chatId: 777, step: 'looking_for' },
    });
  });
});

describe('leaving the Questionnaire through the menu', () => {
  it('ends it on any screen, keeps the answers and files the next text as a message', async () => {
    await begin();
    await say('BMW X5');

    await tap('services:ru');

    expect(stored()[0].capturePrompt).toBeNull();
    expect(stored()[0].comment).toBe('Ищет: BMW X5');

    await say('а сколько по времени?');

    expect(stored()[0].comment).toBe(
      'Ищет: BMW X5\nСообщение: а сколько по времени?',
    );
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('ends it on /menu and shows the menu in the language of the Lead', async () => {
    await begin('vehicle-sourcing_sr');

    await say('/menu');

    expect(stored()[0].capturePrompt).toBeNull();
    expect(stored()[0].comment).toBeNull();
    expect(lastSent()).toEqual([42, 'MENU']);
    expect(lastMarkup()).toEqual({
      inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:sr' }]],
    });
  });

  it('shows /menu in the Telegram language when there is no Lead, writing nothing', async () => {
    await say('/menu', { ...HANDLED, language_code: 'de' });

    expect(stored()).toHaveLength(0);
    expect(lastSent()).toEqual([42, 'MENU']);
    expect(lastMarkup()).toEqual({
      inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:de' }]],
    });
  });
});

describe('the two questions', () => {
  it('asks what the visitor is looking for once they leave a request, in the page locale', async () => {
    await begin('vehicle-sourcing_sr');

    expect(replies()).toHaveLength(2);
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);
    expect(stored()[0].capturePrompt).toEqual({
      chatId: 42,
      step: 'looking_for',
    });
  });

  it('puts the first answer on the card and asks for the budget', async () => {
    await begin();
    api.reset();

    await say('BMW X5, не старше 2018');

    expect(stored()[0].comment).toContain('Ищет: BMW X5, не старше 2018');
    expect(cardEdits()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('puts the budget on the card too', async () => {
    await begin();
    await say('BMW X5');

    await say('до 20 000 евро');

    expect(stored()[0].comment).toContain('Бюджет: до 20 000 евро');
  });

  it('answers in the locale the Lead was created in', async () => {
    await begin('vehicle-sourcing_de');

    await say('ein Kombi');

    expect(lastSent()).toEqual([42, 'BUDGET']);
    expect(stored()[0].locale).toBe('de');
  });
});

describe('a Lead that disappears mid-dialog', () => {
  it('still refreshes the card and keeps the conversation going', async () => {
    await begin();
    vanishOnNextWrite();

    await say('BMW X5');

    expect(cardEdits().at(-1)?.text).toContain('Заявка #1');
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });
});

describe('abandoning the dialog', () => {
  it('leaves the contact and the card intact after the first question', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_ru', ANONYMOUS)));

    expect(stored()[0]).toMatchObject({
      contact: 'tg://user?id=777',
      service: 'vehicle-sourcing',
      status: 'new',
      archived: false,
    });
    expect(cards()).toHaveLength(1);
  });

  it('leaves the contact intact after the second question', async () => {
    await begin();

    await say('BMW X5');

    expect(stored()[0]).toMatchObject({
      contact: '@ivan',
      capturePrompt: { chatId: 42, step: 'budget' },
    });
  });
});

describe('an operator editing the same Lead mid-dialog', () => {
  it('neither side overwrites the other', async () => {
    await begin();
    editLead(1, {
      name: 'Иван Петрович',
      pendingPrompt: { chatId: 111, messageId: 555, kind: 'edit_name' },
    });

    await say('BMW X5');

    expect(stored()[0].name).toBe('Иван Петрович');
    expect(stored()[0].pendingPrompt?.kind).toBe('edit_name');
    expect(stored()[0].comment).toContain('Ищет: BMW X5');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
  });
});

describe('the phone, asked first when nothing else can reach the visitor', () => {
  it('asks for the number through a share-contact button before anything else', async () => {
    await begin(undefined, ANONYMOUS);

    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toEqual({
      keyboard: [
        [{ text: 'SHARE_NUMBER', request_contact: true }],
        [{ text: 'SKIP' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  });

  it('makes the shared number the contact, ahead of the tg://user fallback', async () => {
    await begin(undefined, ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
    expect(lastMarkup()).toEqual({ remove_keyboard: true });
  });

  it('keeps a number that already carries its plus sign', async () => {
    await begin(undefined, ANONYMOUS);

    await POST(makeCtx(contactUpdate('+381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
  });

  it('carries on through the questions after the number', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));

    await say('Golf 7', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'BUDGET']);

    await say('10 000', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'THANKS']);
    expect(stored()[0].capturePrompt).toBeNull();
  });

  it('moves on when the visitor declines, keeping the Lead reachable by bot', async () => {
    await begin(undefined, ANONYMOUS);

    await say('SKIP', ANONYMOUS);

    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
  });
});

describe('the phone, offered last when the visitor has a handle', () => {
  it('comes after both questions, as a call offer', async () => {
    await begin();
    await say('BMW X5');

    await say('20 000');

    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(stored()[0].capturePrompt?.step).toBe('phone');
  });

  it('puts a shared number in the comment and leaves the handle as the contact', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(stored()[0].contact).toBe('@ivan');
    expect(stored()[0].comment).toContain('Телефон: +381601234567');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(lastMarkup()).toEqual({ remove_keyboard: true });
  });

  it('ends the dialog intact when the visitor declines the call', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');

    await say('SKIP');

    expect(stored()[0].contact).toBe('@ivan');
    expect(stored()[0].comment).not.toContain('Телефон');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'THANKS']);
  });
});

describe('a contact shared outside the phone step', () => {
  it('is ignored when the visitor has no dialog open at all', async () => {
    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()).toHaveLength(0);
    expect(api.calls).toHaveLength(0);
  });
});

describe('a visitor who presses Start again', () => {
  const HOUR = 60 * 60 * 1000;

  it('continues the open Lead within the hour instead of capturing again', async () => {
    await begin();
    await say('BMW X5');

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('opens the menu without a greeting when the dialog it rejoins is already done', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'MENU']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('opens the card the new tile names, in the language of the open Lead', async () => {
    await POST(makeCtx(startUpdate('sr')));

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ service: '', locale: 'sr' });
    expect(lastSent()[1]).toContain('CARD_vehicle-import_sr');
  });

  it('starts a fresh enquiry once the hour has passed', async () => {
    await begin();
    editLead(1, {
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
    });

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(stored()).toHaveLength(2);
    expect(stored()[1].service).toBe('vehicle-import');
    expect(lastSent()[1]).toMatch(/^GREETING_en\n\n<b>CARD_vehicle-import_en/);
  });

  it('skips the greeting and brings the share-contact keyboard back', async () => {
    await begin(undefined, ANONYMOUS);
    api.reset();

    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toHaveProperty('keyboard');
  });
});

describe('free text outside the dialog', () => {
  it('lands on the open Lead and refreshes the card', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    api.reset();

    await say('а можно в рассрочку?');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).toContain('Сообщение: а можно в рассрочку?');
    expect(cardEdits()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('leaves a dialog that is still running alone', async () => {
    await begin();
    await say('BMW X5');

    expect(stored()[0].comment).not.toContain('Сообщение');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
  });

  it('opens a new enquiry when the visitor has no open Lead', async () => {
    await say('привет, ищу машину');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).toBe('Сообщение: привет, ищу машину');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nMENU']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('opens a new enquiry when the only Lead is archived', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    editLead(1, { archived: true });

    await say('я вернулся');

    expect(stored()).toHaveLength(2);
  });

  it('still records the message when the Lead vanishes mid-write', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    vanishOnNextWrite();

    await say('ещё вопрос');

    expect(cardEdits().at(-1)?.text).toContain('Заявка #1');
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });
});

describe("the same person tapping another brand's tile", () => {
  it("opens its own Lead instead of resuming the sister brand's", async () => {
    await leadStore.insertLead(sisterLead());

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(2);
    expect(stored()[1]).toMatchObject({ brand: BRAND, telegramId: 42 });
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nMENU']);
  });

  it("answers onto its own Lead, never the sister brand's", async () => {
    await leadStore.insertLead(sisterLead());
    await begin();

    await say('BMW X5');

    expect(stored()[0].comment).toBeNull();
    expect(stored()[1].comment).toContain('Ищет: BMW X5');
  });
});

describe('a second enquiry once the hour has passed', () => {
  const HOUR = 60 * 60 * 1000;

  it('puts the answers on the new Lead, not the one left open', async () => {
    await begin();
    editLead(1, {
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
    });
    await begin('vehicle-import_ru');

    await say('Golf 7');

    expect(stored()).toHaveLength(2);
    expect(stored()[0].comment).toBeNull();
    expect(stored()[1].comment).toContain('Ищет: Golf 7');
    expect(stored()[1].capturePrompt?.step).toBe('budget');
  });

  it('leaves a closed Lead out of the lookup entirely', async () => {
    await begin();
    editLead(1, { status: 'won' });

    await say('ещё одна машина');

    expect(stored()).toHaveLength(2);
    expect(stored()[1].comment).toBe('Сообщение: ещё одна машина');
  });
});

describe('a question typed instead of sharing a number', () => {
  it('reaches the card and the dialog carries on', async () => {
    await begin(undefined, ANONYMOUS);

    await say('сколько стоит?', ANONYMOUS);

    expect(stored()[0].comment).toBe('Сообщение: сколько стоит?');
    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
  });

  it('reaches the card when the call offer comes last too', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');

    await say('а в рассрочку можно?');

    expect(stored()[0].comment).toContain('Сообщение: а в рассрочку можно?');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'THANKS']);
  });
});

describe('a number shared while another question is open', () => {
  it('records it, keeps the dialog where it was and says it arrived', async () => {
    await begin();

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(stored()[0].comment).toBe('Телефон: +381601234567');
    expect(stored()[0].contact).toBe('@ivan');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('becomes the contact when the visitor has no handle', async () => {
    await begin(undefined, ANONYMOUS);
    await say('SKIP', ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'RECEIVED']);
  });

  it('still refreshes the card when the write finds nothing', async () => {
    await begin();
    vanishOnNextWrite();
    api.reset();

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(cardEdits().at(-1)?.text).toContain('Заявка #1');
  });
});

describe('a visitor who already handed over a number', () => {
  const HOUR = 60 * 60 * 1000;

  const ageOut = () => {
    editLead(1, {
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
      status: 'won',
    });
  };

  it('is not asked for it again and keeps it as the contact', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();

    await begin(undefined, ANONYMOUS);

    expect(stored()[1].contact).toBe('+381601234567');
    expect(stored()[1].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
    expect(lastMarkup()).toBeUndefined();
  });

  it('answers the rest of the dialog from there', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();
    await begin(undefined, ANONYMOUS);

    await say('Golf 7', ANONYMOUS);
    await say('10 000', ANONYMOUS);

    expect(stored()[1].comment).toBe('Ищет: Golf 7\nБюджет: 10 000');
    expect(stored()[1].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([777, 'THANKS']);
  });

  it('leaves a sender with a handle on their handle', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();

    await begin(undefined, { ...HANDLED, id: ANONYMOUS.id });

    expect(stored()[1].contact).toBe('@ivan');
    expect(stored()[1].capturePrompt?.step).toBe('looking_for');
  });
});

describe('the admin hearing about every change the visitor makes', () => {
  const VIA_BOT = '🤖 Посетитель через бота';

  it('gets one contact change per admin when a phone is shared', async () => {
    await begin(undefined, ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    for (const id of ADMIN_IDS)
      expect(adminNotes(id)).toEqual([
        [
          '✏️ Заявка #1 Лена: контакт',
          VIA_BOT,
          '',
          'Было: tg://user?id=777',
          'Стало: +381601234567',
        ].join('\n'),
      ]);
  });

  it('gets one comment change for each Questionnaire answer', async () => {
    await begin();

    await say('BMW X5');
    await say('20 000');
    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    const notes = adminNotes();
    expect(notes).toHaveLength(3);
    expect(notes.every((n) => n.includes(': комментарий\n' + VIA_BOT))).toBe(
      true,
    );
    expect(notes[0]).toContain('Стало: Ищет: BMW X5');
    expect(notes[1]).toContain('Было: Ищет: BMW X5');
    expect(notes[2]).toContain('Телефон: +381601234567');
  });

  it('gets one for each free-form message on an open Lead', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    api.reset();

    await say('а можно в рассрочку?');
    await say('и ещё вопрос');

    const notes = adminNotes();
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('Сообщение: а можно в рассрочку?');
    expect(notes[1]).toContain('Сообщение: и ещё вопрос');
  });

  it('hears nothing when the visitor declines the phone', async () => {
    await begin(undefined, ANONYMOUS);

    await say('SKIP', ANONYMOUS);

    expect(adminNotes()).toEqual([]);
  });

  it('hears nothing when the Lead vanished before the write', async () => {
    await begin();
    vanishOnNextWrite();

    await say('BMW X5');

    expect(adminNotes()).toEqual([]);
  });
});

describe('the Contacts screen', () => {
  it('sends the workshop as a venue, then hours, phone and site', async () => {
    POST = route(SECRET, {
      contacts: {
        phone: '381601234567',
        site: 'https://carlab.test',
        venue: WORKSHOP,
      },
    });
    await POST(makeCtx(startUpdate()));
    api.reset();

    await tap('contacts:ru');

    expect(
      api.callsTo('sendVenue', CAPTURE_TOKEN).map((c) => c.payload),
    ).toEqual([
      expect.objectContaining({
        chat_id: 42,
        latitude: 44.8054581,
        longitude: 20.4858424,
        title: 'CarLab',
        address: 'Jovana Ćirilova 23a, Beograd',
      }),
    ]);
    expect(lastSent()).toEqual([
      42,
      'REACH_US\n\nHOURS\n+381 60 1234567\nhttps://carlab.test',
    ]);
    expect(lastMarkup()).toEqual({
      inline_keyboard: [[{ text: 'BACK', callback_data: 'menu:ru' }]],
    });
  });

  it('sends no venue for a brand without a workshop', async () => {
    await POST(makeCtx(startUpdate()));
    api.reset();

    await tap('contacts:en');

    expect(api.callsTo('sendVenue', CAPTURE_TOKEN)).toEqual([]);
    expect(lastSent()).toEqual([
      42,
      'REACH_US\n\nHOURS\n+381 60 1234567\nhttps://example.test',
    ]);
  });

  it('ends a running Questionnaire', async () => {
    await begin();

    await tap('contacts:ru');

    expect(stored()[0].capturePrompt).toBeNull();
  });
});

describe('talking to a manager', () => {
  it('asks for the question and ends a running Questionnaire', async () => {
    await begin();
    api.reset();

    await tap('manager:ru');

    expect(edits()).toEqual([
      expect.objectContaining({
        text: 'WRITE_YOUR_QUESTION',
        reply_markup: {
          inline_keyboard: [[{ text: 'BACK', callback_data: 'menu:ru' }]],
        },
      }),
    ]);
    expect(stored()[0].capturePrompt).toBeNull();
  });

  it('stores the next message on the Lead and tells the admin', async () => {
    await begin();
    await tap('manager:ru');
    api.reset();

    await say('BMW X5');

    expect(stored()[0].comment).toContain('Сообщение: BMW X5');
    expect(stored()[0].comment).not.toContain('Ищет');
    expect(adminNotes()).toEqual([
      expect.stringContaining('Сообщение: BMW X5'),
    ]);
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });
});

describe('the Partners screen', () => {
  function partnerRoute() {
    return route(SECRET, {
      copy: () => COPY,
      menu: ['services', 'partners'],
      serviceCard: (slug) => ({ title: slug, lines: [], url: 'https://x/' }),
      partners: (locale) => [
        { name: 'CarLab', url: referralLink('CarLabRsBot', `${locale}-x`) },
      ],
    });
  }

  it('sits in the menu where the brand enables it', async () => {
    POST = partnerRoute();
    await POST(makeCtx(startUpdate('en')));

    expect(lastMarkup()).toEqual({
      inline_keyboard: [
        [{ text: 'SERVICES', callback_data: 'services:en' }],
        [{ text: 'PARTNERS', callback_data: 'partners:en' }],
      ],
    });
  });

  it('opens the partner bots with a referral payload in the mapped locale', async () => {
    POST = partnerRoute();
    const writes = storage.writeAttempts();

    await tap('partners:sr');

    expect(edits()).toEqual([
      expect.objectContaining({
        text: 'PICK_A_PARTNER',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'CarLab',
                url: 'https://t.me/CarLabRsBot?start=from-approved_sr-x',
              },
            ],
            [{ text: 'BACK', callback_data: 'menu:sr' }],
          ],
        },
      }),
    ]);
    expect(storage.writeAttempts()).toBe(writes);
  });

  it('does not open where the brand has no partners', async () => {
    await tap('partners:ru');

    expect(edits()).toHaveLength(0);
  });
});

describe('a visitor referred by the Approved bot', () => {
  it('lands on a Lead of the receiving brand that says where they came from', async () => {
    await POST(makeCtx(startUpdate('from-approved_sr')));

    expect(stored()[0]).toMatchObject({
      brand: BRAND,
      commissionPercent: 10,
      service: '',
      locale: 'sr',
      comment: 'Пришёл из бота Approved.rs (Партнёры)',
    });
    expect(cards()).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('🤝 из бота Approved.rs'),
      }),
    ]);
    expect(lastSent()).toEqual([42, 'GREETING_sr\n\nMENU']);
  });

  it.each([
    'from-approved_CarLab_sr',
    'from-approved_brand-CarLab_commissionPercent-0_sr',
    'brand-CarLab_from-approved_sr',
  ])('cannot be filed under another brand or rate: %s', async (payload) => {
    await POST(makeCtx(startUpdate(payload)));

    expect(stored()[0]).toMatchObject({
      brand: BRAND,
      commissionPercent: 10,
    });
  });

  it('keeps the payload inside the Telegram limit with a visitor id on it', async () => {
    const link = referralLink('CarLabRsBot', 'sr');
    const payload = stampStartVisitor(
      new URL(link).searchParams.get('start') ?? '',
      '0f8fad5b-d9cb-469f-a165-70867728950e',
    );

    expect(payload).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    await POST(makeCtx(startUpdate(payload ?? '')));
    expect(stored()[0]).toMatchObject({
      visitorId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      locale: 'sr',
      comment: 'Пришёл из бота Approved.rs (Партнёры)',
    });
  });
});

describe("CarLab's Questionnaire: the car and what happened, then the phone", () => {
  beforeEach(() => {
    POST = route(SECRET, { questionnaire: ['car_issue', 'phone'] });
  });

  it('never asks for a budget', async () => {
    await begin();
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);

    await say('Golf 2012, стучит подвеска');
    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(lastMarkup()).toHaveProperty('keyboard');

    await say('SKIP');
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(replies().map((p) => p.text)).not.toContain('BUDGET');
    expect(stored()[0]).toMatchObject({
      comment: 'Машина и проблема: Golf 2012, стучит подвеска',
      capturePrompt: null,
    });
    expect(adminNotes()).toEqual([
      expect.stringContaining(
        'Стало: Машина и проблема: Golf 2012, стучит подвеска',
      ),
    ]);
  });
});

describe("Details' Questionnaire: the car, the service as buttons, then the phone", () => {
  const PICKER = {
    inline_keyboard: [
      [
        {
          text: 'CARD_vehicle-sourcing_ru',
          callback_data: 'pick:ru:vehicle-sourcing',
        },
      ],
      [
        {
          text: 'CARD_vehicle-import_ru',
          callback_data: 'pick:ru:vehicle-import',
        },
      ],
    ],
  };

  beforeEach(() => {
    POST = route(SECRET, {
      questionnaire: ['car', 'service', 'phone'],
      menu: ['services', 'request'],
    });
  });

  async function beginFromMenu(from: Record<string, unknown> = HANDLED) {
    await POST(makeCtx(startUpdate(undefined, from)));
    await tap('request:ru', from);
  }

  it('offers Leave a request on the main menu', async () => {
    await POST(makeCtx(startUpdate()));

    expect(lastMarkup()).toEqual({
      inline_keyboard: [
        [{ text: 'SERVICES', callback_data: 'services:ru' }],
        [{ text: 'REQUEST', callback_data: 'request:ru' }],
      ],
    });
  });

  it('asks for the service as buttons and files the tap as the service', async () => {
    await beginFromMenu();
    expect(lastSent()).toEqual([42, 'CAR']);

    await say('Audi A6 2019');
    expect(lastSent()).toEqual([42, 'WHICH_SERVICE']);
    expect(lastMarkup()).toEqual(PICKER);
    api.reset();

    await tap('pick:ru:vehicle-import');

    expect(stored()[0]).toMatchObject({
      comment: 'Машина: Audi A6 2019',
      service: 'vehicle-import',
      services: ['vehicle-import'],
      capturePrompt: { chatId: 42, step: 'phone' },
    });
    expect(adminNotes()).toEqual([
      expect.stringContaining(': услуга\n🤖 Посетитель через бота'),
    ]);
    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(edits()).toHaveLength(0);

    await say('SKIP');
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(stored()[0].capturePrompt).toBeNull();
  });

  it('takes a typed service as an answer too', async () => {
    await beginFromMenu();
    await say('Audi A6 2019');

    await say('полировка');

    expect(stored()[0]).toMatchObject({
      comment: 'Машина: Audi A6 2019\nУслуга: полировка',
      service: '',
      capturePrompt: { chatId: 42, step: 'phone' },
    });
  });

  it('skips the service when the request came from a service card', async () => {
    await begin();
    expect(lastSent()).toEqual([42, 'CAR']);

    await say('Audi A6 2019');

    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(replies().map((p) => p.text)).not.toContain('WHICH_SERVICE');
  });

  it('skips the service when the open Lead already has one', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_ru')));
    await tap('request:ru');

    await say('Audi A6 2019');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      capturePrompt: { chatId: 42, step: 'phone' },
    });
  });

  it('asks a visitor with no handle for the phone first, then the rest', async () => {
    await beginFromMenu(ANONYMOUS);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);

    await POST(makeCtx(contactUpdate('381601234567')));
    expect(lastSent()).toEqual([777, 'CAR']);
    expect(lastMarkup()).toEqual({ remove_keyboard: true });

    await say('Audi A6 2019', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'WHICH_SERVICE']);

    await tap('pick:ru:vehicle-sourcing', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'THANKS']);
    expect(stored()[0]).toMatchObject({
      contact: '+381601234567',
      service: 'vehicle-sourcing',
      capturePrompt: null,
    });
  });

  it('ignores a service tap outside the service question', async () => {
    await beginFromMenu();
    api.reset();

    await tap('pick:ru:vehicle-import');
    await say('Audi A6 2019');
    await tap('pick:ru:no-such-service');

    expect(stored()[0]).toMatchObject({
      service: '',
      capturePrompt: { chatId: 42, step: 'service' },
    });
    expect(replies().map((p) => p.text)).toEqual(['WHICH_SERVICE']);
  });

  it('ignores a request for a service it does not offer', async () => {
    await tap('request:ru:no-such-service');

    expect(stored()).toHaveLength(0);
    expect(replies()).toHaveLength(0);
  });

  it('finishes a step left over from an older Questionnaire', async () => {
    await beginFromMenu();
    editLead(1, { capturePrompt: { chatId: 42, step: 'budget' } });

    await say('20 000');

    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(stored()[0]).toMatchObject({
      comment: 'Бюджет: 20 000',
      capturePrompt: null,
    });
  });
});
