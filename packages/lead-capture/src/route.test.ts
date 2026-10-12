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
import { captureWebhookSecret, createCaptureWebhookRoute } from './route.ts';

const SECRET = 'capture-webhook-secret';
const CAPTURE_TOKEN = '2001:capture-token';
const CRM_TOKEN = '2002:crm-token';
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
  phoneButton: 'SHARE_NUMBER',
  thanks: 'THANKS',
  received: 'RECEIVED',
  menu: { text: 'MENU', back: 'BACK' },
  services: { button: 'SERVICES', text: 'PICK_A_SERVICE' },
  card: { request: 'LEAVE_A_REQUEST', site: 'ON_THE_SITE' },
  contacts: { button: 'CONTACTS', text: 'REACH_US', hours: 'HOURS' },
  manager: {
    button: 'MANAGER',
    text: 'WRITE_YOUR_QUESTION',
    handoff: 'MANAGER_IN_TELEGRAM',
    chat: 'OPEN_MANAGER_CHAT',
  },
  partners: { button: 'PARTNERS', text: 'PICK_A_PARTNER' },
  request: {
    button: 'REQUEST',
    car: 'CAR',
    service: 'WHICH_SERVICES',
    done: 'DONE',
    unsure: 'NOT_SURE',
  },
  language: { button: 'LANGUAGE', text: 'PICK_A_LANGUAGE' },
  profile: {
    description: 'DESCRIPTION',
    shortDescription: 'SHORT_DESCRIPTION',
    menuCommand: 'MENU_COMMAND',
    langCommand: 'LANG_COMMAND',
  },
};

const WORKSHOP = {
  title: 'CarLab',
  street: 'Jovana Ćirilova 23a',
  city: 'Beograd',
  lat: 44.8054581,
  lon: 20.4858424,
};

const LANGUAGES = {
  ru: 'Русский',
  en: 'English',
  sr: 'Srpski',
  es: 'Español',
  de: 'Deutsch',
};

const MENU_KEYBOARD = {
  inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:ru' }]],
};

let api: RecordedBotApi;
let storage: MemoryStorage;
let leadStore: LeadStore;
let ensureLeadCard: (lead: StoredLead) => Promise<void>;
let ensureLeadTopic: (lead: StoredLead) => Promise<StoredLead>;
let touchLeadTopic: (lead: StoredLead) => Promise<StoredLead>;
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
    store: leadStore,
    ensureLeadTopic,
    touchLeadTopic,
    ensureLeadCard,
    bot: createTelegramClient(CAPTURE_TOKEN, 'capture_bot').bot,
    groupId: GROUP_ID,
    brand: BRAND,
    isLocale: (value): value is TestLocale => LOCALES.includes(value),
    primaryLocale: 'ru',
    copy: (locale) => ({ ...COPY, greeting: `GREETING_${locale}` }),
    menu: ['services'],
    languages: LANGUAGES,
    services: SERVICES,
    serviceCard: (slug, locale) => ({
      title: `CARD_${slug}_${locale}`,
      lines: ['ABOUT <it>', '', 'FROM 100 €'],
      url: `https://example.test/${locale}/${slug}/`,
    }),
    questionnaire: ['looking_for', 'budget'],
    phoneRegion: 'RS',
    ...overrides,
  });
}

function stored(): StoredLead[] {
  return (storage.current() ?? []) as StoredLead[];
}

function editLead(id: number, patch: Partial<StoredLead>) {
  storage.seed(stored().map((l) => (l.id === id ? { ...l, ...patch } : l)));
}

function abandon(id: number) {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000 - 1000).toISOString();
  editLead(id, { createdAt: hourAgo, visitorActiveAt: hourAgo });
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

function picker(locale: string, picked: string[] = []) {
  const toggle = (slug: string) => [
    {
      text: `${picked.includes(slug) ? '✅ ' : ''}CARD_${slug}_${locale}`,
      callback_data: `pick:${locale}:${slug}`,
    },
  ];
  return {
    inline_keyboard: [
      ...SERVICES.map(toggle),
      [
        {
          text: picked.length > 0 ? 'DONE' : 'NOT_SURE',
          callback_data: `done:${locale}`,
          style: 'success',
        },
      ],
    ],
  };
}

function expectThanksThenMenu(chatId: number, menu: unknown = MENU_KEYBOARD) {
  expect(replies().slice(-2)).toEqual([
    expect.objectContaining({
      chat_id: chatId,
      text: 'THANKS',
      reply_markup: { remove_keyboard: true },
    }),
    expect.objectContaining({
      chat_id: chatId,
      text: 'MENU',
      reply_markup: menu,
    }),
  ]);
}

function cards() {
  return api
    .callsTo('sendMessage', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => p.chat_id === GROUP_ID && p.message_thread_id === undefined);
}

function topicPosts() {
  return api
    .callsTo('sendMessage', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => p.message_thread_id !== undefined);
}

function adminNotes(chatId = ADMIN_IDS[0]) {
  return api
    .callsTo('sendMessage', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => p.chat_id === chatId)
    .map((p) => String(p.text));
}

function isSummary(payload: Record<string, unknown>): boolean {
  return stored().some((l) => l.topicMessageId === payload.message_id);
}

function cardEdits() {
  return api
    .callsTo('editMessageText', CRM_TOKEN)
    .map((c) => c.payload)
    .filter((p) => !isSummary(p));
}

function summaryEdits() {
  return api
    .callsTo('editMessageText', CRM_TOKEN)
    .map((c) => c.payload)
    .filter(isSummary);
}

function topicCopies() {
  return api.callsTo('copyMessage', CAPTURE_TOKEN).map((c) => c.payload);
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
  await tap(`done:${locale}`, from);
}

function edits() {
  return api.callsTo('editMessageText', CAPTURE_TOKEN).map((c) => c.payload);
}

async function say(text: string, from: Record<string, unknown> = HANDLED) {
  await POST(makeCtx(textUpdate(text, from)));
}

async function reachPhone(payload?: string) {
  await begin(payload, ANONYMOUS);
  await say('BMW X5', ANONYMOUS);
  await say('до 30k', ANONYMOUS);
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
    storageFor: (path) => (storages[path] = createMemoryStorage()),
    getNotifier: vi.fn(),
  }));
  storage = storages[LEADS_PATH];
  ({ ensureLeadCard, ensureLeadTopic, touchLeadTopic } = createBrandBot({
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
  vi.useRealTimers();
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

describe('captureWebhookSecret', () => {
  it('reads the secret from the environment', () => {
    expect(
      captureWebhookSecret({ TELEGRAM_CAPTURE_WEBHOOK_SECRET: 's3cret' }),
    ).toBe('s3cret');
  });

  it.each([
    {},
    { TELEGRAM_CAPTURE_WEBHOOK_SECRET: '' },
    { TELEGRAM_CAPTURE_WEBHOOK_SECRET: 42 },
  ])('treats a missing or malformed secret as unset: %o', (env) => {
    expect(captureWebhookSecret(env)).toBeUndefined();
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
  it('puts a card in front of the owner with the contact already on it', async () => {
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
            style: 'success',
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
    await tap('request:de:vehicle-sourcing');
    await tap('pick:de:vehicle-import');

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
  it('sets the service and opens the services step with it ticked', async () => {
    await POST(makeCtx(startUpdate('sr')));
    api.reset();

    await tap('request:sr:vehicle-import');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import'],
      capturePrompt: { chatId: 42, step: 'service' },
    });
    expect(cardEdits()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(lastMarkup()).toEqual(picker('sr', ['vehicle-import']));
  });

  it('asks the questions first even when nothing else reaches the visitor', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_ru', ANONYMOUS)));

    await tap('request:ru:vehicle-import', ANONYMOUS);

    expect(adminNotes()).toEqual([]);
    expect(lastSent()).toEqual([777, 'WHICH_SERVICES']);
  });

  it('opens a Lead when the visitor has none open', async () => {
    await tap('request:en:vehicle-sourcing');

    expect(stored()).toEqual([
      expect.objectContaining({
        brand: BRAND,
        contact: '@ivan',
        service: 'vehicle-sourcing',
        locale: 'en',
        capturePrompt: { chatId: 42, step: 'service' },
      }),
    ]);
    expect(cards()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(lastMarkup()).toEqual(picker('en', ['vehicle-sourcing']));
  });

  it('opens a new Lead when the open one is older than the hour', async () => {
    await POST(makeCtx(startUpdate('ru')));
    abandon(1);

    await tap('request:ru:vehicle-import');

    expect(stored()).toHaveLength(2);
    expect(stored()[0].capturePrompt).toBeNull();
    expect(stored()[1]).toMatchObject({
      service: 'vehicle-import',
      capturePrompt: { chatId: 42, step: 'service' },
    });
    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
  });

  it('runs the whole Questionnaire in the language of the tapped card', async () => {
    POST = route(SECRET, {
      copy: (locale) => ({ ...COPY, lookingFor: `LOOKING_FOR_${locale}` }),
    });
    await POST(makeCtx(startUpdate('ru')));

    await tap('request:en:vehicle-import');
    await tap('done:en');
    expect(lastSent()).toEqual([42, 'LOOKING_FOR_en']);
    expect(stored()[0].locale).toBe('en');

    await tap('request:sr:vehicle-import');
    await tap('done:sr');
    await say('BMW X5');
    expect(stored()[0].locale).toBe('sr');
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('asks the next question when the staff cannot be told', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await begin();
    POST = route(SECRET, {
      ensureLeadCard: vi.fn().mockRejectedValue(new Error('group down')),
    });

    await say('BMW X5');

    expect(stored()[0].comment).toContain('Ищет: BMW X5');
    expect(lastSent()).toEqual([42, 'BUDGET']);
    expect(error).toHaveBeenCalledWith(
      '[capture] could not update the card',
      expect.objectContaining({ leadId: 1 }),
    );
  });

  it('handles the tap when Telegram refuses to acknowledge it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await POST(makeCtx(startUpdate('ru')));
    api.fail('answerCallbackQuery', 'query is too old');

    await tap('request:ru:vehicle-import');

    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(error).toHaveBeenCalledWith(
      '[capture] could not answer the tap',
      expect.anything(),
    );
  });

  it('opens a Lead with the phone the visitor gave before', async () => {
    await begin(undefined, ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    editLead(1, { status: 'won' });

    await tap('request:ru:vehicle-import', ANONYMOUS);

    expect(stored()[1]).toMatchObject({
      contact: '+381601234567',
      capturePrompt: { chatId: 777, step: 'service' },
    });
  });
});

describe('leaving the Questionnaire through the menu', () => {
  it('ends it on any screen, keeps the answers and sends the next text to the topic only', async () => {
    await begin();
    await say('BMW X5');

    await tap('services:ru');

    expect(stored()[0].capturePrompt).toBeNull();
    expect(stored()[0].comment).toBe('Ищет: BMW X5');

    await say('а сколько по времени?');

    expect(stored()[0].comment).toBe('Ищет: BMW X5');
    expect(topicCopies().at(-1)).toEqual({
      chat_id: GROUP_ID,
      from_chat_id: 42,
      message_id: 11,
      message_thread_id: 1,
    });
    expect(lastSent()).toEqual([42, 'RECEIVED']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('takes the share-contact keyboard away when a screen ends the phone step', async () => {
    await reachPhone();
    api.reset();

    await tap('services:ru', ANONYMOUS);

    expect(replies()).toEqual([
      expect.objectContaining({
        chat_id: 777,
        text: 'PICK_A_SERVICE',
        reply_markup: { remove_keyboard: true },
      }),
    ]);
    expect(api.callsTo('deleteMessage', CAPTURE_TOKEN)).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ chat_id: 777 }),
      }),
    ]);
    expect(edits()).toHaveLength(1);
  });

  it('takes the share-contact keyboard away on /menu too', async () => {
    await reachPhone();
    api.reset();

    await say('/menu', ANONYMOUS);

    expect(replies().map((r) => r.reply_markup)).toEqual([
      { remove_keyboard: true },
      MENU_KEYBOARD,
    ]);
  });

  it('leaves the keyboard alone when the step it ends is not the phone', async () => {
    await begin();
    api.reset();

    await say('/menu');

    expect(api.callsTo('deleteMessage', CAPTURE_TOKEN)).toEqual([]);
    expect(replies()).toHaveLength(1);
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

    expect(replies()).toHaveLength(3);
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
      status: 'open',
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

describe('an owner editing the same Lead mid-dialog', () => {
  it('neither side overwrites the other', async () => {
    await begin();
    editLead(1, {
      name: 'Иван Петрович',
      pendingPrompt: { chatId: 111, messageId: 555, kind: 'postpone' },
    });

    await say('BMW X5');

    expect(stored()[0].name).toBe('Иван Петрович');
    expect(stored()[0].pendingPrompt?.kind).toBe('postpone');
    expect(stored()[0].comment).toContain('Ищет: BMW X5');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
  });
});

describe('the phone, asked last when nothing else can reach the visitor', () => {
  it('comes after the questions, through a share-contact button and no skip', async () => {
    await begin(undefined, ANONYMOUS);
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
    await say('Golf 7', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'BUDGET']);

    await say('10 000', ANONYMOUS);

    expect(stored()[0].capturePrompt?.step).toBe('phone');
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toEqual({
      keyboard: [[{ text: 'SHARE_NUMBER', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  });

  it('makes the shared number the contact and ends the dialog', async () => {
    await reachPhone();

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0]).toMatchObject({
      contact: '+381601234567',
      comment: 'Ищет: BMW X5\nБюджет: до 30k',
      capturePrompt: null,
    });
    expectThanksThenMenu(777);
  });

  it('keeps a number that already carries its plus sign', async () => {
    await reachPhone();

    await POST(makeCtx(contactUpdate('+381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
  });

  it.each([
    ['064 123 4567', '+381641234567'],
    ['+49 151 2345678', '+491512345678'],
  ])('takes a typed number, %s, as the contact', async (typed, e164) => {
    await reachPhone();

    await say(typed, ANONYMOUS);

    expect(stored()[0]).toMatchObject({ contact: e164, capturePrompt: null });
    expect(stored()[0].comment).not.toContain(typed);
    expectThanksThenMenu(777);
  });

  it('files anything else as a message and asks for the number again', async () => {
    await reachPhone();
    api.reset();

    await say('не хочу', ANONYMOUS);

    expect(stored()[0]).toMatchObject({
      contact: 'tg://user?id=777',
      capturePrompt: { chatId: 777, step: 'phone' },
    });
    expect(stored()[0].comment).toContain('Сообщение: не хочу');
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toHaveProperty('keyboard');
  });

  it('skips the step when the Lead already has a phone', async () => {
    await POST(makeCtx(contactUpdate('381601234567')));
    await tap('request:ru:vehicle-import', ANONYMOUS);
    await tap('done:ru', ANONYMOUS);
    await say('BMW X5', ANONYMOUS);

    await say('до 30k', ANONYMOUS);

    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([777, 'THANKS']);
  });
});

describe('a visitor with a handle', () => {
  it('is never asked for the phone: the handle is the contact', async () => {
    await begin();
    await say('BMW X5');

    await say('20 000');

    expect(stored()[0]).toMatchObject({
      contact: '@ivan',
      capturePrompt: null,
    });
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('puts a number shared on a dialog left at the old phone step in the comment', async () => {
    await begin();
    editLead(1, { capturePrompt: { chatId: 42, step: 'phone' } });

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(stored()[0].contact).toBe('@ivan');
    expect(stored()[0].comment).toContain('Телефон: +381601234567');
    expect(stored()[0].capturePrompt).toBeNull();
    expectThanksThenMenu(42);
  });
});

describe('a contact shared outside the phone step', () => {
  it('starts a Lead with that phone when the visitor has no dialog open at all', async () => {
    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      contact: '+381601234567',
      telegramId: 777,
      comment: null,
    });
    expect(lastSent()).toEqual([777, 'GREETING_ru\n\nMENU']);
  });

  it('keeps the handle as the contact and the shared phone as a note', async () => {
    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(stored()[0]).toMatchObject({
      contact: '@ivan',
      comment: 'Телефон: +381601234567',
    });
  });

  it('still becomes the contact of the open Lead after the Questionnaire ended', async () => {
    await begin(undefined, ANONYMOUS);
    await tap('services:ru', ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0]).toMatchObject({
      contact: '+381601234567',
      capturePrompt: null,
    });
    expect(topicCopies().at(-1)).toMatchObject({
      from_chat_id: 777,
      message_id: 12,
      message_thread_id: 1,
    });
    expect(lastSent()).toEqual([777, 'RECEIVED']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });
});

describe("someone else's contact card", () => {
  const friend = (from: Record<string, unknown> = ANONYMOUS) => {
    const update = contactUpdate('381609999999', from);
    return {
      ...update,
      message: {
        ...update.message,
        contact: { phone_number: '381609999999', user_id: 999 },
      },
    };
  };

  it('is not taken for the phone, and the phone question comes back', async () => {
    await reachPhone();
    api.reset();

    await POST(makeCtx(friend()));

    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('phone');
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
  });

  it('is not taken for the phone when the card carries no user at all', async () => {
    await begin(undefined, ANONYMOUS);
    const update = contactUpdate('381609999999');

    await POST(
      makeCtx({
        ...update,
        message: { ...update.message, contact: { phone_number: '1' } },
      }),
    );

    expect(stored()[0].contact).toBe('tg://user?id=777');
  });

  it('only reaches the topic outside a dialog', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    const before = stored()[0];
    api.reset();

    await POST(makeCtx(friend()));

    expect(stored()[0]).toEqual({
      ...before,
      topicActiveAt: expect.any(String),
    });
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_id: 12, message_thread_id: 1 }),
    ]);
    expect(lastSent()).toEqual([777, 'RECEIVED']);
  });
});

describe('a visitor who presses Start again', () => {
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

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'MENU']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('opens the card a new tile names on a finished Questionnaire without touching the Lead', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    const before = stored()[0];

    await POST(makeCtx(startUpdate('vehicle-import_ru')));

    expect(stored()).toEqual([before]);
    expect(lastSent()[1]).toContain('CARD_vehicle-import_ru');
  });

  it('opens the card the new tile names, in the language of the open Lead', async () => {
    await POST(makeCtx(startUpdate('sr')));

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import'],
      locale: 'sr',
    });
    expect(lastSent()[1]).toContain('CARD_vehicle-import_sr');
  });

  it('ends a running Questionnaire for the card the new tile names, keeping the picks', async () => {
    await begin();
    await say('BMW X5');

    await POST(makeCtx(startUpdate('vehicle-import_ru')));

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      service: 'vehicle-sourcing',
      services: ['vehicle-sourcing', 'vehicle-import'],
      capturePrompt: null,
    });
    expect(lastSent()[1]).toContain('CARD_vehicle-import_ru');
  });

  it('takes the share-contact keyboard away when the tile ends the phone step', async () => {
    await reachPhone();
    api.reset();

    await POST(makeCtx(startUpdate('vehicle-import_ru', ANONYMOUS)));

    expect(replies()[0]).toMatchObject({
      chat_id: 777,
      reply_markup: { remove_keyboard: true },
    });
    expect(api.callsTo('deleteMessage', CAPTURE_TOKEN)).toHaveLength(1);
    expect(lastSent()[1]).toContain('CARD_vehicle-import_ru');
  });

  it('marks a referral from the Approved bot on the open Lead without a note', async () => {
    await POST(makeCtx(startUpdate('sr')));

    await POST(makeCtx(startUpdate('from-approved_sr')));
    await POST(makeCtx(startUpdate('from-approved_sr')));

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      referredBy: 'approved',
      comment: null,
    });
    expect(lastSent()).toEqual([42, 'MENU']);
  });

  it('starts a fresh enquiry once the hour has passed', async () => {
    await begin();
    abandon(1);

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(stored()).toHaveLength(2);
    expect(stored()[1].service).toBe('vehicle-import');
    expect(lastSent()[1]).toMatch(/^GREETING_en\n\n<b>CARD_vehicle-import_en/);
  });

  it('skips the greeting and brings the share-contact keyboard back', async () => {
    await reachPhone();
    api.reset();

    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toHaveProperty('keyboard');
  });
});

describe('free text outside the dialog', () => {
  it('goes to the topic only, leaving the finished Lead as it was', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    const before = stored()[0];
    api.reset();

    await say('а можно в рассрочку?');

    expect(stored()).toEqual([
      { ...before, topicActiveAt: expect.any(String) },
    ]);
    expect(topicCopies()).toEqual([
      {
        chat_id: GROUP_ID,
        from_chat_id: 42,
        message_id: 11,
        message_thread_id: 1,
      },
    ]);
    expect(cardEdits()).toHaveLength(0);
    expect(summaryEdits()).toHaveLength(0);
    expect(lastSent()).toEqual([42, 'RECEIVED']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
  });

  it('leaves a dialog that is still running alone', async () => {
    await begin();
    await say('BMW X5');

    expect(stored()[0].comment).not.toContain('Сообщение');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
  });

  it('opens a new enquiry when the visitor has no Lead, then copies the text into its topic', async () => {
    await say('привет, ищу машину');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).toBe('Сообщение: привет, ищу машину');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nMENU']);
    expect(lastMarkup()).toEqual(MENU_KEYBOARD);
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_id: 11, message_thread_id: 1 }),
    ]);
  });

  it('keeps writing into the topic of a Lead older than the hour', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    abandon(1);

    await say('я снова ищу машину');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).not.toContain('я снова ищу машину');
    expect(topicCopies().at(-1)).toMatchObject({ message_thread_id: 1 });
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('reaches the topic of a won Lead without opening a new one', async () => {
    await begin();
    await say('BMW X5');
    await say('20 000');
    editLead(1, { status: 'won' });
    api.reset();

    await say('я вернулся');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].status).toBe('won');
    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toHaveLength(0);
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_id: 11, message_thread_id: 1 }),
    ]);
  });

  it('opens a topic for a Lead from before topics, then copies the text into it', async () => {
    const legacy = await leadStore.insertLead({
      ...sisterLead(),
      brand: BRAND,
      capturePrompt: null,
    });
    expect(legacy.topicId).toBeNull();

    await say('добрый день');

    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({ topicId: 1, comment: null });
    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toHaveLength(1);
    expect(topicCopies()).toEqual([
      {
        chat_id: GROUP_ID,
        from_chat_id: 42,
        message_id: 11,
        message_thread_id: 1,
      },
    ]);
  });

  it('still answers the visitor when the topic cannot take the copy', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await POST(makeCtx(startUpdate('ru')));
    api.fail('copyMessage', 'not enough rights');

    await say('ещё вопрос');

    expect(lastSent()).toEqual([42, 'RECEIVED']);
    expect(error).toHaveBeenCalledWith(
      '[capture] could not post to the topic',
      expect.objectContaining({ leadId: 1 }),
    );
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
  it('puts the answers on the new Lead, not the one left open', async () => {
    await begin();
    abandon(1);
    await begin('vehicle-import_ru');

    await say('Golf 7');

    expect(stored()).toHaveLength(2);
    expect(stored()[0].comment).toBeNull();
    expect(stored()[1].comment).toContain('Ищет: Golf 7');
    expect(stored()[1].capturePrompt?.step).toBe('budget');
  });

  it('sends the next text to the topic of the Lead /start opened, not the abandoned dialog', async () => {
    await begin();
    abandon(1);
    await POST(makeCtx(startUpdate('ru')));

    await say('Golf 7');

    expect(stored()[0]).toMatchObject({ comment: null, capturePrompt: null });
    expect(stored()[1].comment).toBeNull();
    expect(topicCopies().at(-1)).toMatchObject({
      message_thread_id: stored()[1].topicId,
    });
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('files a shared number on the Lead /start opened too', async () => {
    await begin(undefined, ANONYMOUS);
    abandon(1);
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[1].contact).toBe('+381601234567');
  });

  it('lets an abandoned dialog expire: the next text reaches the topic, not the answers', async () => {
    await begin();
    abandon(1);

    await say('Golf 7');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).toBeNull();
    expect(topicCopies().at(-1)).toMatchObject({ message_thread_id: 1 });
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('ends the abandoned dialog when a request opens the new Lead', async () => {
    await begin();
    abandon(1);

    await tap('request:ru:vehicle-import');

    expect(stored()[0].capturePrompt).toBeNull();
    expect(stored()[1].capturePrompt).toEqual({
      chatId: 42,
      step: 'service',
    });
  });

  it('keeps a dialog that is older than the hour but still being answered', async () => {
    await begin();
    editLead(1, {
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    await say('BMW X5');

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });
});

describe('a phone typed at another question', () => {
  it('is an answer to the question asked, not the contact', async () => {
    await begin(undefined, ANONYMOUS);

    await say('064 123 4567', ANONYMOUS);

    expect(stored()[0].comment).toBe('Ищет: 064 123 4567');
    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
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

  it('becomes the contact when the visitor has no handle, and the phone step drops', async () => {
    await begin(undefined, ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'RECEIVED']);

    await say('BMW X5', ANONYMOUS);
    await say('до 30k', ANONYMOUS);
    expect(stored()[0].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([777, 'THANKS']);
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

describe('the admin', () => {
  it('gets no DM about what the visitor changes', async () => {
    await begin(undefined, ANONYMOUS);
    await say('BMW X5', ANONYMOUS);
    await say('20 000', ANONYMOUS);
    await POST(makeCtx(contactUpdate('381601234567')));
    await say('а можно в рассрочку?', ANONYMOUS);

    for (const id of ADMIN_IDS) expect(adminNotes(id)).toEqual([]);
  });
});

describe('every message the visitor sends', () => {
  const media = (
    content: Record<string, unknown>,
    from: Record<string, unknown> = HANDLED,
  ) => ({
    update_id: 5,
    message: {
      message_id: 13,
      chat: { id: from.id, type: 'private' },
      from,
      ...content,
    },
  });
  const PHOTO = {
    photo: [{ file_id: 'p', file_unique_id: 'u', width: 1, height: 1 }],
  };
  const VOICE = { voice: { file_id: 'v', file_unique_id: 'u', duration: 3 } };

  it('copies each Questionnaire answer into the topic as the Lead fills in', async () => {
    await begin();

    await say('BMW X5');

    expect(stored()[0].comment).toBe('Ищет: BMW X5');
    expect(topicCopies()).toEqual([
      {
        chat_id: GROUP_ID,
        from_chat_id: 42,
        message_id: 11,
        message_thread_id: 1,
      },
    ]);
  });

  it('leaves commands out of the topic', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('/menu');
    await say('/lang');

    expect(topicCopies()).toEqual([]);
  });

  it.each([
    ['a photo', PHOTO],
    ['a voice message', VOICE],
    ['a document', { document: { file_id: 'd', file_unique_id: 'u' } }],
    ['a sticker', { sticker: { file_id: 's', file_unique_id: 'u' } }],
  ])(
    'copies %s into the topic of the finished Lead, leaving it as it was',
    async (_, content) => {
      await begin();
      await say('BMW X5');
      await say('20 000');
      const before = stored()[0];
      api.reset();

      await POST(makeCtx(media(content)));

      expect(stored()).toEqual([
        { ...before, topicActiveAt: expect.any(String) },
      ]);
      expect(topicCopies()).toEqual([
        {
          chat_id: GROUP_ID,
          from_chat_id: 42,
          message_id: 13,
          message_thread_id: 1,
        },
      ]);
      expect(lastSent()).toEqual([42, 'RECEIVED']);
    },
  );

  it('copies a photo sent mid-Questionnaire and asks the same question again', async () => {
    await begin();
    const before = stored()[0];

    await POST(makeCtx(media(PHOTO)));

    expect(stored()[0]).toEqual({
      ...before,
      topicActiveAt: expect.any(String),
    });
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_id: 13, message_thread_id: 1 }),
    ]);
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);
  });

  it('opens a Lead for a visitor who starts with a photo, then copies it into the topic', async () => {
    await POST(makeCtx(media(VOICE, ANONYMOUS)));

    expect(stored()).toEqual([
      expect.objectContaining({ telegramId: 777, comment: null, topicId: 1 }),
    ]);
    expect(topicCopies()).toEqual([
      expect.objectContaining({ from_chat_id: 777, message_thread_id: 1 }),
    ]);
    expect(lastSent()).toEqual([777, 'GREETING_ru\n\nMENU']);
  });

  it('reopens a closed topic before copying the message into it', async () => {
    vi.useFakeTimers({
      now: new Date('2026-10-20T08:00:00.000Z'),
      toFake: ['Date'],
    });
    await begin();
    await say('BMW X5');
    await say('20 000');
    editLead(stored()[0].id, { topicClosed: true });
    api.reset();

    await POST(makeCtx(media(PHOTO)));

    expect(
      api.calls
        .filter((c) => /ForumTopic|copyMessage/.test(c.method))
        .map((c) => [c.method, c.payload.message_thread_id]),
    ).toEqual([
      ['reopenForumTopic', 1],
      ['copyMessage', 1],
    ]);
    expect(stored()[0]).toMatchObject({
      topicClosed: false,
      topicActiveAt: '2026-10-20T08:00:00.000Z',
    });
  });

  it('copies into an open topic without reopening it', async () => {
    await begin();
    api.reset();

    await POST(makeCtx(media(PHOTO)));

    expect(api.callsTo('reopenForumTopic')).toEqual([]);
    expect(topicCopies()).toHaveLength(1);
  });

  it('copies nothing when the topic cannot be opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    POST = route(SECRET, {
      ensureLeadTopic: async (lead) => lead,
    });

    await say('привет');

    expect(stored()).toHaveLength(1);
    expect(topicCopies()).toEqual([]);
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
  const MANAGER_MENU = {
    inline_keyboard: [
      [{ text: 'SERVICES', callback_data: 'services:ru' }],
      [{ text: 'MANAGER', callback_data: 'manager:ru', style: 'primary' }],
    ],
  };

  function handoffPosts() {
    return api
      .callsTo('sendMessage', CAPTURE_TOKEN)
      .map((c) => c.payload)
      .filter((p) => p.chat_id === GROUP_ID);
  }

  function withManager() {
    POST = route(SECRET, {
      menu: ['services', 'manager'],
      humanTelegram: 'brand_manager',
    });
  }

  it('puts the manager last as a blue tap whether or not the brand names an account', async () => {
    withManager();
    await POST(makeCtx(startUpdate('ru')));
    expect(lastMarkup()).toEqual(MANAGER_MENU);

    POST = route(SECRET, { menu: ['services', 'manager'] });
    await POST(makeCtx(startUpdate('ru')));
    expect(lastMarkup()).toEqual(MANAGER_MENU);
  });

  it('marks the hand-off once, tells the topic and opens the chat link in place', async () => {
    withManager();
    await POST(makeCtx(startUpdate('ru')));
    api.reset();

    await tap('manager:ru');
    const [first] = stored();
    await tap('manager:ru');

    expect(first.managerHandoff).toEqual({
      at: expect.any(String),
      handle: 'brand_manager',
    });
    expect(stored()[0].managerHandoff).toEqual(first.managerHandoff);
    expect(handoffPosts()).toEqual([
      expect.objectContaining({
        text: '👤 Ушёл к менеджеру @brand_manager',
        message_thread_id: 1,
      }),
    ]);
    expect(summaryEdits().at(-1)?.text).toContain(
      '👤 Ушёл к менеджеру @brand_manager',
    );
    expect(edits()).toEqual(
      Array(2).fill(
        expect.objectContaining({
          text: 'MANAGER_IN_TELEGRAM',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'OPEN_MANAGER_CHAT',
                  url: 'https://t.me/brand_manager',
                },
              ],
              [{ text: 'BACK', callback_data: 'menu:ru' }],
            ],
          },
        }),
      ),
    );
  });

  it('marks a Lead whose Questionnaire is already finished', async () => {
    withManager();
    await begin();
    await say('BMW X5');
    await say('до 30k');
    expect(stored()[0].questionnaireDone).toBe(true);

    await tap('manager:ru');

    expect(stored()[0].managerHandoff?.handle).toBe('brand_manager');
  });

  it('only opens the chat link when the visitor has no Lead yet', async () => {
    withManager();

    await tap('manager:ru');

    expect(stored()).toEqual([]);
    expect(handoffPosts()).toEqual([]);
    expect(edits()).toEqual([
      expect.objectContaining({ text: 'MANAGER_IN_TELEGRAM' }),
    ]);
  });

  it('records no hand-off when the brand names no account', async () => {
    await POST(makeCtx(startUpdate('ru')));

    await tap('manager:ru');

    expect(stored()[0].managerHandoff).toBeNull();
    expect(handoffPosts()).toEqual([]);
  });

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

  it('sends the next message to the topic, not into the Lead', async () => {
    await begin();
    await tap('manager:ru');
    api.reset();

    await say('BMW X5');

    expect(stored()[0].comment).toBeNull();
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_id: 11, message_thread_id: 1 }),
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
      service: '',
      locale: 'sr',
      referredBy: 'approved',
      comment: null,
    });
    expect(cards()).toEqual([
      expect.objectContaining({
        text: expect.stringContaining('🤝 из бота Approved.rs'),
      }),
    ]);
    expect(lastSent()).toEqual([42, 'GREETING_sr\n\nMENU']);
  });

  it('is not marked by a visitor typing the referral note', async () => {
    await say('Пришёл из бота Approved.rs (Партнёры)');

    expect(stored()[0].referredBy).toBeNull();
    expect(cards()[0].text).not.toContain('🤝');
  });

  it.each([
    'from-approved_CarLab_sr',
    'from-approved_brand-CarLab_sr',
    'brand-CarLab_from-approved_sr',
  ])('cannot be filed under another brand: %s', async (payload) => {
    await POST(makeCtx(startUpdate(payload)));

    expect(stored()[0]).toMatchObject({
      brand: BRAND,
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
      comment: null,
    });
  });
});

describe("CarLab's Questionnaire: the car and what happened, then the phone", () => {
  beforeEach(() => {
    POST = route(SECRET, { questionnaire: ['car_issue'] });
  });

  it('never asks for a budget', async () => {
    await begin();
    expect(lastSent()).toEqual([42, 'LOOKING_FOR']);

    await say('Golf 2012, стучит подвеска');
    expect(lastSent()).toEqual([42, 'THANKS']);
    expect(replies().map((p) => p.text)).not.toContain('BUDGET');
    expect(stored()[0]).toMatchObject({
      comment: 'Машина и проблема: Golf 2012, стучит подвеска',
      capturePrompt: null,
    });
  });
});

describe('the services step that opens every Questionnaire', () => {
  const DETAILS_MENU = {
    inline_keyboard: [
      [{ text: 'REQUEST', callback_data: 'request:ru', style: 'success' }],
      [{ text: 'SERVICES', callback_data: 'services:ru' }],
    ],
  };

  beforeEach(() => {
    POST = route(SECRET, {
      questionnaire: ['car'],
      menu: ['request', 'services'],
    });
  });

  async function beginFromMenu(from: Record<string, unknown> = HANDLED) {
    await POST(makeCtx(startUpdate(undefined, from)));
    await tap('request:ru', from);
  }

  it('offers Leave a request first on the main menu, alone on its row and green', async () => {
    await POST(makeCtx(startUpdate()));

    expect(lastMarkup()).toEqual(DETAILS_MENU);
  });

  it('asks which services first, with a green Not sure while nothing is picked', async () => {
    await beginFromMenu();

    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(lastMarkup()).toEqual(picker('ru'));
    expect(stored()[0].capturePrompt).toEqual({ chatId: 42, step: 'service' });
  });

  it('ticks and unticks services in place and keeps the picked set on the Lead', async () => {
    await beginFromMenu();
    api.reset();

    await tap('pick:ru:vehicle-import');
    await tap('pick:ru:vehicle-sourcing');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import', 'vehicle-sourcing'],
      capturePrompt: { chatId: 42, step: 'service' },
    });
    expect(edits().at(-1)).toMatchObject({
      chat_id: 42,
      message_id: 900,
      text: 'WHICH_SERVICES',
      reply_markup: picker('ru', ['vehicle-import', 'vehicle-sourcing']),
    });

    await tap('pick:ru:vehicle-import');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-sourcing',
      services: ['vehicle-sourcing'],
    });
    expect(edits()).toHaveLength(3);
    expect(edits().at(-1)?.reply_markup).toEqual(
      picker('ru', ['vehicle-sourcing']),
    );
    expect(replies()).toHaveLength(0);
    expect(cardEdits().at(-1)?.text).toContain('vehicle-sourcing');
  });

  it('keeps both picks when two taps race', async () => {
    await beginFromMenu();

    await Promise.all([
      tap('pick:ru:vehicle-import'),
      tap('pick:ru:vehicle-sourcing'),
    ]);

    expect([...stored()[0].services].sort()).toEqual([
      'vehicle-import',
      'vehicle-sourcing',
    ]);
  });

  it("adds a card's service to the picks already made instead of replacing them", async () => {
    await beginFromMenu();
    await tap('pick:ru:vehicle-import');

    await tap('request:ru:vehicle-sourcing');

    expect(stored()[0]).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import', 'vehicle-sourcing'],
    });
    expect(lastMarkup()).toEqual(
      picker('ru', ['vehicle-import', 'vehicle-sourcing']),
    );
  });

  it('moves on to the next question on Done, keeping every picked service', async () => {
    await beginFromMenu();
    await tap('pick:ru:vehicle-sourcing');
    await tap('pick:ru:vehicle-import');

    await tap('done:ru');
    expect(lastSent()).toEqual([42, 'CAR']);

    await say('Audi A6 2019');

    expect(stored()[0]).toMatchObject({
      comment: 'Машина: Audi A6 2019',
      service: 'vehicle-sourcing',
      services: ['vehicle-sourcing', 'vehicle-import'],
      capturePrompt: null,
    });
    expect(lastSent()).toEqual([42, 'THANKS']);
  });

  it('leaves the services empty when the visitor is not sure', async () => {
    await beginFromMenu();

    await tap('done:ru');

    expect(stored()[0]).toMatchObject({
      service: '',
      services: [],
      comment: null,
      capturePrompt: { chatId: 42, step: 'car' },
    });
    expect(lastSent()).toEqual([42, 'CAR']);
  });

  it('takes a typed answer as the services too', async () => {
    await beginFromMenu();

    await say('полировка');

    expect(stored()[0]).toMatchObject({
      comment: 'Услуга: полировка',
      service: '',
      capturePrompt: { chatId: 42, step: 'car' },
    });
  });

  it('starts with the service card ticked and does not skip the step', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_ru')));

    await tap('request:ru:vehicle-import');

    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(lastMarkup()).toEqual(picker('ru', ['vehicle-import']));
  });

  it('shows the services already on the open Lead ticked', async () => {
    await POST(makeCtx(startUpdate('vehicle-import_ru')));

    await tap('request:ru');

    expect(lastMarkup()).toEqual(picker('ru', ['vehicle-import']));
  });

  it('shows the picked set again when the visitor presses Start mid-step', async () => {
    await beginFromMenu();
    await tap('pick:ru:vehicle-sourcing');

    await say('/start');

    expect(lastSent()).toEqual([42, 'WHICH_SERVICES']);
    expect(lastMarkup()).toEqual(picker('ru', ['vehicle-sourcing']));
  });

  it('asks a visitor with no handle the rest first, then the phone', async () => {
    await beginFromMenu(ANONYMOUS);
    await tap('pick:ru:vehicle-sourcing', ANONYMOUS);
    await tap('done:ru', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'CAR']);

    await say('Audi A6 2019', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);

    await POST(makeCtx(contactUpdate('381601234567')));
    expectThanksThenMenu(777, DETAILS_MENU);
    expect(stored()[0]).toMatchObject({
      contact: '+381601234567',
      service: 'vehicle-sourcing',
      capturePrompt: null,
    });
  });

  it('ignores service taps outside the services step and services it does not offer', async () => {
    await beginFromMenu();
    await tap('pick:ru:no-such-service');
    await tap('done:ru');
    api.reset();

    await tap('pick:ru:vehicle-import');
    await tap('done:ru');

    expect(stored()[0]).toMatchObject({
      services: [],
      capturePrompt: { chatId: 42, step: 'car' },
    });
    expect(edits()).toHaveLength(0);
    expect(replies()).toHaveLength(0);
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

describe('switching the language', () => {
  it('offers every locale the site serves on /lang, in the Telegram language, writing nothing', async () => {
    await say('/lang', { ...HANDLED, language_code: 'en' });

    expect(stored()).toHaveLength(0);
    expect(lastSent()).toEqual([42, 'PICK_A_LANGUAGE']);
    expect(lastMarkup()).toEqual({
      inline_keyboard: [
        [{ text: '🇷🇺 Русский', callback_data: 'locale:ru' }],
        [{ text: '🇬🇧 English', callback_data: 'locale:en' }],
        [{ text: '🇷🇸 Srpski', callback_data: 'locale:sr' }],
        [{ text: '🇪🇸 Español', callback_data: 'locale:es' }],
        [{ text: '🇩🇪 Deutsch', callback_data: 'locale:de' }],
        [{ text: 'BACK', callback_data: 'menu:en' }],
      ],
    });
  });

  it('opens the picker in place from a menu button, aimed back at the menu', async () => {
    await tap('language:sr');

    expect(edits()[0]).toMatchObject({
      text: 'PICK_A_LANGUAGE',
      reply_markup: {
        inline_keyboard: expect.arrayContaining([
          [{ text: '🇬🇧 English', callback_data: 'locale:en' }],
          [{ text: 'BACK', callback_data: 'menu:sr' }],
        ]),
      },
    });
  });

  it.each(['ru', 'de'])(
    'labels the menu button with every locale flag, the same in %s',
    async (locale) => {
      POST = route(SECRET, { menu: ['services', 'language'] });
      await say('/menu', { ...HANDLED, language_code: locale });

      expect(lastMarkup()).toEqual({
        inline_keyboard: [
          [{ text: 'SERVICES', callback_data: `services:${locale}` }],
          [
            {
              text: '🌐 🇷🇺 🇬🇧 🇷🇸 🇪🇸 🇩🇪',
              callback_data: `language:${locale}`,
            },
          ],
        ],
      });
    },
  );

  it('marks a locale it has no flag for with a plain one', async () => {
    POST = route(SECRET, {
      menu: ['language'],
      languages: { ru: 'Русский', xx: 'Xx' },
    });
    await say('/menu');

    expect(lastMarkup()).toEqual({
      inline_keyboard: [[{ text: '🌐 🇷🇺 🏳️', callback_data: 'language:ru' }]],
    });
  });

  it('shows the menu in the new locale', async () => {
    await tap('locale:de');

    expect(edits()[0]).toMatchObject({
      text: 'MENU',
      reply_markup: {
        inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:de' }]],
      },
    });
  });

  it.each(['locale:fr', 'locale:xx:menu'])(
    'ignores a switch it cannot carry out: %s',
    async (data) => {
      await tap(data);

      expect(edits()).toHaveLength(0);
      expect(stored()).toHaveLength(0);
    },
  );

  it('moves an open Lead to the new locale, and later messages follow it', async () => {
    await begin('vehicle-sourcing_ru');

    await tap('locale:sr');

    expect(stored()[0].locale).toBe('sr');
    expect(stored()[0].capturePrompt).toBeNull();
    expect(cards()).toHaveLength(1);
    expect(adminNotes()).toHaveLength(0);

    await say('/menu', { ...HANDLED, language_code: 'en' });

    expect(lastMarkup()).toEqual({
      inline_keyboard: [[{ text: 'SERVICES', callback_data: 'services:sr' }]],
    });
  });

  it('leaves a Lead already in that locale untouched', async () => {
    await POST(makeCtx(startUpdate('en')));
    const writes = storage.writeAttempts();

    await tap('locale:en');

    expect(storage.writeAttempts()).toBe(writes);
    expect(edits()).toHaveLength(1);
  });
});

describe('the Lead topic', () => {
  it('opens one topic per Lead at /start, with the summary as its first message', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_ru')));

    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toEqual([
      expect.objectContaining({
        payload: { chat_id: GROUP_ID, name: '#1 · Иван Петров · Approved.rs' },
      }),
    ]);
    expect(topicPosts()).toEqual([
      expect.objectContaining({
        chat_id: GROUP_ID,
        message_thread_id: 1,
        text: expect.stringContaining(
          'Контакт: <a href="https://t.me/ivan">@ivan</a> (Telegram)',
        ),
      }),
    ]);
    const [lead] = stored();
    expect(lead).toMatchObject({ topicId: 1, topicMessageId: 1000 });
    expect(JSON.stringify(cards()[0].reply_markup)).toContain(
      'https://t.me/c/500/1',
    );
  });

  it('reuses the topic when the visitor presses /start again', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_ru')));
    await POST(makeCtx(startUpdate('vehicle-import_ru')));
    await POST(makeCtx(startUpdate()));

    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toHaveLength(1);
    expect(stored()).toHaveLength(1);
  });

  it('edits the summary as the Questionnaire fills in', async () => {
    await begin();
    await say('BMW X5');

    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toHaveLength(1);
    expect(String(summaryEdits().at(-1)?.text)).toContain('Ищет: BMW X5');
  });

  it('lists every picked service in the summary', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_ru')));
    await tap('request:ru:vehicle-sourcing');
    await tap('pick:ru:vehicle-import');

    expect(String(summaryEdits().at(-1)?.text)).toContain(
      'vehicle-sourcing · vehicle-import',
    );
  });

  it('opens the topic when /start merges into a placeholder click, not before', async () => {
    await leadStore.insertOrMergeLead({
      brand: BRAND,
      name: '',
      contact: '—',
      service: '',
      contactChannel: 'telegram',
      comment: null,
      country: null,
      source_url: 'https://example.test/ru/',
      visitorId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      locale: 'ru',
      kind: 'call_click',
    });
    expect(stored()[0].topicId).toBeNull();

    await POST(
      makeCtx(
        startUpdate('vehicle-import_ru_0f8fad5bd9cb469fa16570867728950e'),
      ),
    );

    expect(stored()).toHaveLength(1);
    expect(stored()[0].topicId).toBe(1);
  });

  it('opens the topic for a fresh Lead that has none when the visitor presses /start again', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('createForumTopic', 'Bad Request: not enough rights');
    await POST(makeCtx(startUpdate('ru')));
    expect(stored()[0].topicId).toBeNull();
    api.reset();

    await POST(makeCtx(startUpdate('ru')));

    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toHaveLength(1);
    expect(stored()[0]).toMatchObject({
      topicId: 1,
      topicMessageId: expect.any(Number),
    });
    expect(error).toHaveBeenCalled();
  });

  it('keeps a topic whose summary failed and posts the summary on the next message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('sendMessage', 'Bad Request: try later');
    await POST(makeCtx(startUpdate('ru')));
    expect(stored()[0]).toMatchObject({ topicId: 1, topicMessageId: null });
    api.reset();

    await say('Есть вопрос');

    expect(api.callsTo('createForumTopic', CRM_TOKEN)).toEqual([]);
    expect(topicPosts()).toEqual([
      expect.objectContaining({ message_thread_id: 1 }),
    ]);
    expect(stored()[0].topicMessageId).toEqual(expect.any(Number));
    expect(topicCopies()).toEqual([
      expect.objectContaining({ message_thread_id: 1 }),
    ]);
    expect(error).toHaveBeenCalled();
  });

  it('still posts the card when the topic cannot be opened', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    api.fail('createForumTopic', 'Bad Request: not enough rights');

    await POST(makeCtx(startUpdate('vehicle-sourcing_ru')));

    expect(cards()).toHaveLength(1);
    expect(stored()[0].topicId).toBeNull();
    expect(error).toHaveBeenCalledWith(
      '[capture] could not update the topic',
      expect.objectContaining({ leadId: 1 }),
    );
  });
});
