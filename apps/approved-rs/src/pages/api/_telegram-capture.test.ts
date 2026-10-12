import { describe, expect, it, vi } from 'vitest';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { LEADS_PATH } from '@podbor/lead-crm';
import { recordBotApi, type MemoryStorage } from '@podbor/lead-crm/testing';

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = (path: string) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

vi.mock('@podbor/lead-crm/storage/local', () =>
  memory.module('localLeadStorage'),
);

import { POST } from './telegram-capture';
import { content } from '@/i18n/content';
import { PHONE_NUMBER, SITE_URL } from '@/utils/constants';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

function start(payload: string) {
  return POST({
    request: new Request('http://localhost/api/telegram-capture', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'test-capture-webhook-secret',
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 42, type: 'private' },
          from: { id: 42, first_name: 'Ivan', username: 'ivan' },
          text: `/start ${payload}`,
        },
      }),
    }),
  });
}

function visitorUpdate(update: Record<string, unknown>) {
  return POST({
    request: new Request('http://localhost/api/telegram-capture', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'test-capture-webhook-secret',
      },
      body: JSON.stringify({ update_id: 1, ...update }),
    }),
  });
}

const VISITOR = { id: 61, first_name: 'Ana', username: 'ana' };

const NO_HANDLE = { id: 62, first_name: 'Mila' };

type Visitor = { id: number; first_name: string; username?: string };

function answer(text: string, from: Visitor = VISITOR) {
  return visitorUpdate({
    message: {
      message_id: 2,
      chat: { id: from.id, type: 'private' },
      from,
      text,
    },
  });
}

function press(data: string, from: Visitor = VISITOR) {
  return visitorUpdate({
    callback_query: {
      id: 'tap',
      from,
      chat_instance: 'chat',
      data,
      message: {
        message_id: 3,
        date: 0,
        chat: { id: from.id, type: 'private' },
      },
    },
  });
}

function questions(from: Visitor = VISITOR): unknown[] {
  return api
    .callsTo('sendMessage', '1002:test-capture-bot-token')
    .filter((call) => call.payload.chat_id === from.id)
    .map((call) => call.payload.text);
}

function lastReply() {
  return api.callsTo('sendMessage', '1002:test-capture-bot-token').at(-1)
    ?.payload as { reply_markup: { inline_keyboard: unknown[][] } };
}

function visitorLead(from: Visitor = VISITOR) {
  return (
    memory.storages.get(LEADS_PATH)?.current() as { telegramId: number }[]
  ).find((lead) => lead.telegramId === from.id);
}

function tap(data: string) {
  return visitorUpdate({
    update_id: 2,
    callback_query: {
      id: 'tap-1',
      from: { id: 42, first_name: 'Ivan', username: 'ivan' },
      chat_instance: 'instance',
      data,
      message: {
        message_id: 900,
        date: 0,
        chat: { id: 42, type: 'private' },
        text: 'MENU',
      },
    },
  });
}

describe('the Approved capture bot', () => {
  it('opens a service hub card from the services content, in Serbian', async () => {
    await start('vehicle-import_sr');

    const { services, captureBot } = content('sr');
    const reply = api
      .callsTo('sendMessage', '1002:test-capture-bot-token')
      .at(-1)?.payload as { text: string; reply_markup: unknown };
    const { hub } = services['vehicle-import'];
    expect(reply.text).toContain(`<b>${hub.title} ${hub.titleHighlight}</b>`);
    expect(reply.text).toContain(hub.description);
    expect(reply.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: captureBot.card.request,
            callback_data: 'request:sr:vehicle-import',
            style: 'success',
          },
        ],
        [
          {
            text: captureBot.card.site,
            url: new URL('/sr/vehicle-import/', SITE_URL).href,
          },
        ],
        [{ text: captureBot.menu.back, callback_data: 'services:sr' }],
      ],
    });
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({
        brand: 'Approved.rs',
        service: 'vehicle-import',
        locale: 'sr',
        topicId: 1,
      }),
    ]);
    expect(
      api.callsTo('createForumTopic', '1001:test-bot-token')[0]?.payload,
    ).toMatchObject({ chat_id: '-1009876543210' });
  });

  it('sends hours, phone and site with no venue', async () => {
    api.reset();
    await tap('contacts:sr');

    expect(api.callsTo('sendVenue', '1002:test-capture-bot-token')).toEqual([]);
    const reply = api
      .callsTo('sendMessage', '1002:test-capture-bot-token')
      .at(-1)?.payload as { text: string };
    expect(reply.text).toContain(content('sr').captureBot.contacts.hours);
    expect(reply.text).toContain(formatPhone(PHONE_NUMBER));
    expect(reply.text).toContain(SITE_URL);
  });

  it('sends the visitor to the sister bots from Partners, in their locale', async () => {
    await POST({
      request: new Request('http://localhost/api/telegram-capture', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'test-capture-webhook-secret',
        },
        body: JSON.stringify({
          update_id: 2,
          callback_query: {
            id: 'tap',
            from: { id: 42, first_name: 'Ivan' },
            chat_instance: 'instance',
            data: 'partners:de',
            message: {
              message_id: 900,
              date: 0,
              chat: { id: 42, type: 'private' },
            },
          },
        }),
      }),
    });

    const edit = api
      .callsTo('editMessageText', '1002:test-capture-bot-token')
      .at(-1)?.payload as { text: string; reply_markup: unknown };
    const { captureBot } = content('de');
    expect(edit.text).toBe(captureBot.partners.text);
    expect(edit.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: 'CarLab',
            url: 'https://t.me/CarLabRsBot?start=from-approved_en',
          },
        ],
        [
          {
            text: 'Details',
            url: 'https://t.me/DetailsRsBot?start=from-approved_en',
          },
        ],
        [{ text: captureBot.menu.back, callback_data: 'menu:de' }],
      ],
    });
  });
});

describe('the Approved Questionnaire', () => {
  it('asks a visitor with no username for the phone last, with no skip, and takes a typed number', async () => {
    const words = content('ru').captureBot;

    await press('request:ru:vehicle-import', NO_HANDLE);
    await press('done:ru', NO_HANDLE);
    await answer('BMW X5 2019', NO_HANDLE);
    await answer('40 000 €', NO_HANDLE);
    await answer('064 123 4567', NO_HANDLE);

    expect(questions(NO_HANDLE)).toEqual([
      words.request.service,
      words.lookingFor,
      words.budget,
      words.phoneAsk,
      words.thanks,
      words.menu.text,
    ]);
    expect(
      api
        .callsTo('sendMessage', '1002:test-capture-bot-token')
        .find((call) => call.payload.text === words.phoneAsk)?.payload
        .reply_markup,
    ).toEqual({
      keyboard: [[{ text: words.phoneButton, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
    expect(visitorLead(NO_HANDLE)).toMatchObject({
      contact: '+381641234567',
      capturePrompt: null,
    });
  });

  it('asks a visitor with a username what they are looking for and the budget, never the phone', async () => {
    const words = content('ru').captureBot;

    await press('request:ru:vehicle-import');

    const picker = lastReply().reply_markup.inline_keyboard;
    expect(picker).toHaveLength(4 + 1);
    expect(picker[3]).toEqual([
      expect.objectContaining({
        text: expect.stringMatching(/^✅ /),
        callback_data: 'pick:ru:vehicle-import',
      }),
    ]);
    expect(picker.at(-1)).toEqual([
      { text: words.request.done, callback_data: 'done:ru', style: 'success' },
    ]);

    await press('pick:ru:vehicle-sourcing');

    const edited = api
      .callsTo('editMessageText', '1002:test-capture-bot-token')
      .at(-1)?.payload as { reply_markup: { inline_keyboard: unknown[][] } };
    expect(edited.reply_markup.inline_keyboard[0]).toEqual([
      expect.objectContaining({ text: expect.stringMatching(/^✅ /) }),
    ]);

    await press('done:ru');
    await answer('BMW X5 2019');
    await answer('40 000 €');

    expect(questions()).toEqual([
      words.request.service,
      words.lookingFor,
      words.budget,
      words.thanks,
    ]);
    expect(lastReply().reply_markup.inline_keyboard[0]).toEqual([
      {
        text: words.request.button,
        callback_data: 'request:ru',
        style: 'success',
      },
    ]);
    expect(words.request.button).toMatch(/^📝 /);
    expect(visitorLead()).toMatchObject({
      service: 'vehicle-import',
      services: ['vehicle-import', 'vehicle-sourcing'],
      comment: 'Ищет: BMW X5 2019\nБюджет: 40 000 €',
      capturePrompt: null,
    });
  });
});

describe('the language switch', () => {
  it('offers exactly the locales the site serves', async () => {
    await POST({
      request: new Request('http://localhost/api/telegram-capture', {
        method: 'POST',
        headers: {
          'x-telegram-bot-api-secret-token': 'test-capture-webhook-secret',
        },
        body: JSON.stringify({
          update_id: 2,
          message: {
            message_id: 2,
            chat: { id: 43, type: 'private' },
            from: { id: 43, first_name: 'Ana' },
            text: '/lang',
          },
        }),
      }),
    });

    const reply = api
      .callsTo('sendMessage', '1002:test-capture-bot-token')
      .at(-1)?.payload as {
      reply_markup: { inline_keyboard: { callback_data: string }[][] };
    };
    const offered = reply.reply_markup.inline_keyboard
      .flat()
      .map((b) => b.callback_data)
      .filter((d) => d.startsWith('locale:'))
      .map((d) => d.split(':')[1]);
    expect(offered).toEqual(['ru', 'en', 'sr', 'es', 'de']);
  });
});

describe('a photo from the visitor', () => {
  it('is copied by the capture bot into the visitor topic', async () => {
    const from = { id: 63, first_name: 'Vera' };

    await visitorUpdate({
      message: {
        message_id: 7,
        chat: { id: from.id, type: 'private' },
        from,
        photo: [{ file_id: 'p', file_unique_id: 'u', width: 1, height: 1 }],
      },
    });

    const { topicId } = visitorLead(from) as unknown as { topicId: number };
    expect(topicId).toEqual(expect.any(Number));
    expect(
      api
        .callsTo('copyMessage', '1002:test-capture-bot-token')
        .map((call) => call.payload),
    ).toContainEqual({
      chat_id: '-1009876543210',
      from_chat_id: from.id,
      message_id: 7,
      message_thread_id: topicId,
    });
  });
});

describe('the Approved main menu', () => {
  it('links «Написать менеджеру» straight to the manager account', async () => {
    await answer('/start ru', { id: 71, first_name: 'Menu', username: 'menu' });

    expect(lastReply().reply_markup.inline_keyboard).toContainEqual([
      {
        text: content('ru').captureBot.manager.button,
        url: 'https://t.me/approvedrs',
      },
    ]);
  });
});
