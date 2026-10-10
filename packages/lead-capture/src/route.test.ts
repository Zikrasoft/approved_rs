import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrandBot,
  createBrandStore,
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
import { createCaptureBot } from './bot.ts';
import { captureStore, createCaptureWebhookRoute } from './route.ts';

const SECRET = 'capture-webhook-secret';
const CAPTURE_TOKEN = 'capture-token';
const CRM_TOKEN = 'crm-token';
const GROUP_ID = '-100500';
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

let api: RecordedBotApi;
let storage: MemoryStorage;
let leadStore: LeadStore;
let ensureLeadCard: (lead: StoredLead) => Promise<void>;
let POST: ReturnType<typeof createCaptureWebhookRoute>;

function route(secret: string | undefined) {
  return createCaptureWebhookRoute({
    secret,
    store: captureStore(leadStore),
    ensureLeadCard,
    bot: createCaptureBot(CAPTURE_TOKEN, 'capture_bot'),
    brand: BRAND,
    isService: (value) => SERVICES.includes(value),
    isLocale: (value): value is TestLocale => LOCALES.includes(value),
    primaryLocale: 'ru',
    copy: (locale) => ({ ...COPY, greeting: `GREETING_${locale}` }),
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
  return api.callsTo('sendMessage', CRM_TOKEN).map((c) => c.payload);
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
  ({ ensureLeadCard } = createBrandBot({
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

describe('the two questions', () => {
  it('greets and asks what the visitor is looking for, in the page locale', async () => {
    await POST(makeCtx(startUpdate('vehicle-sourcing_sr')));

    expect(replies()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'GREETING_sr\n\nLOOKING_FOR']);
  });

  it('puts the first answer on the card and asks for the budget', async () => {
    await POST(makeCtx(startUpdate('ru')));
    api.reset();

    await say('BMW X5, не старше 2018');

    expect(stored()[0].comment).toContain('Ищет: BMW X5, не старше 2018');
    expect(cardEdits()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('puts the budget on the card too', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    await say('до 20 000 евро');

    expect(stored()[0].comment).toContain('Бюджет: до 20 000 евро');
  });

  it('answers in the locale the Lead was created in', async () => {
    await POST(makeCtx(startUpdate('de')));

    await say('ein Kombi');

    expect(lastSent()).toEqual([42, 'BUDGET']);
    expect(stored()[0].locale).toBe('de');
  });
});

describe('a Lead that disappears mid-dialog', () => {
  it('still refreshes the card and keeps the conversation going', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru')));

    await say('BMW X5');

    expect(stored()[0]).toMatchObject({
      contact: '@ivan',
      capturePrompt: { chatId: 42, step: 'budget' },
    });
  });
});

describe('an operator editing the same Lead mid-dialog', () => {
  it('neither side overwrites the other', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(lastSent()).toEqual([777, 'GREETING_ru\n\nPHONE_ASK']);
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
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
    expect(lastMarkup()).toEqual({ remove_keyboard: true });
  });

  it('keeps a number that already carries its plus sign', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await POST(makeCtx(contactUpdate('+381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
  });

  it('carries on through the questions after the number', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await POST(makeCtx(contactUpdate('381601234567')));

    await say('Golf 7', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'BUDGET']);

    await say('10 000', ANONYMOUS);
    expect(lastSent()).toEqual([777, 'THANKS']);
    expect(stored()[0].capturePrompt).toBeNull();
  });

  it('moves on when the visitor declines, keeping the Lead reachable by bot', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await say('SKIP', ANONYMOUS);

    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
  });
});

describe('the phone, offered last when the visitor has a handle', () => {
  it('comes after both questions, as a call offer', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    await say('20 000');

    expect(lastSent()).toEqual([42, 'PHONE_OFFER']);
    expect(stored()[0].capturePrompt?.step).toBe('phone');
  });

  it('puts a shared number in the comment and leaves the handle as the contact', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'BUDGET']);
  });

  it('says nothing new when the dialog it rejoins is already done', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');

    await POST(makeCtx(startUpdate('ru')));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([42, 'THANKS']);
  });

  it('starts a fresh enquiry once the hour has passed', async () => {
    await POST(makeCtx(startUpdate('ru')));
    editLead(1, {
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
    });

    await POST(makeCtx(startUpdate('vehicle-import_en')));

    expect(stored()).toHaveLength(2);
    expect(stored()[1].service).toBe('vehicle-import');
    expect(lastSent()).toEqual([42, 'GREETING_en\n\nLOOKING_FOR']);
  });

  it('skips the greeting and brings the share-contact keyboard back', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    api.reset();

    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(stored()).toHaveLength(1);
    expect(lastSent()).toEqual([777, 'PHONE_ASK']);
    expect(lastMarkup()).toHaveProperty('keyboard');
  });
});

describe('free text outside the dialog', () => {
  it('lands on the open Lead and refreshes the card', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');

    expect(stored()[0].comment).not.toContain('Сообщение');
    expect(stored()[0].capturePrompt?.step).toBe('budget');
  });

  it('opens a new enquiry when the visitor has no open Lead', async () => {
    await say('привет, ищу машину');

    expect(stored()).toHaveLength(1);
    expect(stored()[0].comment).toBe('Сообщение: привет, ищу машину');
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nLOOKING_FOR']);
  });

  it('opens a new enquiry when the only Lead is archived', async () => {
    await POST(makeCtx(startUpdate('ru')));
    await say('BMW X5');
    await say('20 000');
    await say('SKIP');
    editLead(1, { archived: true });

    await say('я вернулся');

    expect(stored()).toHaveLength(2);
  });

  it('still records the message when the Lead vanishes mid-write', async () => {
    await POST(makeCtx(startUpdate('ru')));
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

    await POST(makeCtx(startUpdate('vehicle-sourcing_ru')));

    expect(stored()).toHaveLength(2);
    expect(stored()[1]).toMatchObject({ brand: BRAND, telegramId: 42 });
    expect(lastSent()).toEqual([42, 'GREETING_ru\n\nLOOKING_FOR']);
  });

  it("answers onto its own Lead, never the sister brand's", async () => {
    await leadStore.insertLead(sisterLead());
    await POST(makeCtx(startUpdate('ru')));

    await say('BMW X5');

    expect(stored()[0].comment).toBeNull();
    expect(stored()[1].comment).toContain('Ищет: BMW X5');
  });
});

describe('a second enquiry once the hour has passed', () => {
  const HOUR = 60 * 60 * 1000;

  it('puts the answers on the new Lead, not the one left open', async () => {
    await POST(makeCtx(startUpdate('ru')));
    editLead(1, {
      createdAt: new Date(Date.now() - HOUR - 1000).toISOString(),
    });
    await POST(makeCtx(startUpdate('vehicle-import_ru')));

    await say('Golf 7');

    expect(stored()).toHaveLength(2);
    expect(stored()[0].comment).toBeNull();
    expect(stored()[1].comment).toContain('Ищет: Golf 7');
    expect(stored()[1].capturePrompt?.step).toBe('budget');
  });

  it('leaves a closed Lead out of the lookup entirely', async () => {
    await POST(makeCtx(startUpdate('ru')));
    editLead(1, { status: 'won' });

    await say('ещё одна машина');

    expect(stored()).toHaveLength(2);
    expect(stored()[1].comment).toBe('Сообщение: ещё одна машина');
  });
});

describe('a question typed instead of sharing a number', () => {
  it('reaches the card and the dialog carries on', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await say('сколько стоит?', ANONYMOUS);

    expect(stored()[0].comment).toBe('Сообщение: сколько стоит?');
    expect(stored()[0].contact).toBe('tg://user?id=777');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'LOOKING_FOR']);
  });

  it('reaches the card when the call offer comes last too', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru')));

    await POST(makeCtx(contactUpdate('381601234567', HANDLED)));

    expect(stored()[0].comment).toBe('Телефон: +381601234567');
    expect(stored()[0].contact).toBe('@ivan');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([42, 'RECEIVED']);
  });

  it('becomes the contact when the visitor has no handle', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await say('SKIP', ANONYMOUS);

    await POST(makeCtx(contactUpdate('381601234567')));

    expect(stored()[0].contact).toBe('+381601234567');
    expect(stored()[0].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'RECEIVED']);
  });

  it('still refreshes the card when the write finds nothing', async () => {
    await POST(makeCtx(startUpdate('ru')));
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
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();

    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    expect(stored()[1].contact).toBe('+381601234567');
    expect(stored()[1].capturePrompt?.step).toBe('looking_for');
    expect(lastSent()).toEqual([777, 'GREETING_ru\n\nLOOKING_FOR']);
    expect(lastMarkup()).toBeUndefined();
  });

  it('answers the rest of the dialog from there', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));

    await say('Golf 7', ANONYMOUS);
    await say('10 000', ANONYMOUS);

    expect(stored()[1].comment).toBe('Ищет: Golf 7\nБюджет: 10 000');
    expect(stored()[1].capturePrompt).toBeNull();
    expect(lastSent()).toEqual([777, 'THANKS']);
  });

  it('leaves a sender with a handle on their handle', async () => {
    await POST(makeCtx(startUpdate('ru', ANONYMOUS)));
    await POST(makeCtx(contactUpdate('381601234567')));
    ageOut();

    await POST(makeCtx(startUpdate('ru', { ...HANDLED, id: ANONYMOUS.id })));

    expect(stored()[1].contact).toBe('@ivan');
    expect(stored()[1].capturePrompt?.step).toBe('looking_for');
  });
});
