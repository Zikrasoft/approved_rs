import { describe, expect, it, vi } from 'vitest';
import { WORKSHOP_ADDRESS } from '@podbor/brands';
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

describe('the CarLab capture bot', () => {
  it('opens a service card from the services content, in Serbian', async () => {
    await start('diagnostics_sr');

    const { services, captureBot } = content('sr');
    const reply = api
      .callsTo('sendMessage', '1002:test-capture-bot-token')
      .at(-1)?.payload as { text: string; reply_markup: unknown };
    expect(reply.text).toContain(services.diagnostics.short);
    expect(reply.text).toContain(services.diagnostics.priceFrom);
    expect(reply.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: captureBot.card.request,
            callback_data: 'request:sr:diagnostics',
          },
        ],
        [
          {
            text: captureBot.card.site,
            url: new URL('/sr/services/diagnostics/', SITE_URL).href,
          },
        ],
        [{ text: captureBot.menu.back, callback_data: 'services:sr' }],
      ],
    });
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({
        brand: 'CarLab',
        service: 'diagnostics',
        locale: 'sr',
        topicId: 1,
      }),
    ]);
    expect(
      api.callsTo('createForumTopic', '1001:test-bot-token')[0]?.payload,
    ).toMatchObject({ chat_id: '-1009876543210' });
  });

  it('sends the workshop venue, then hours, phone and site', async () => {
    api.reset();
    await tap('contacts:sr');

    expect(api.callsTo('sendVenue', '1002:test-capture-bot-token')).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          latitude: WORKSHOP_ADDRESS.lat,
          longitude: WORKSHOP_ADDRESS.lon,
        }),
      }),
    ]);
    const reply = api
      .callsTo('sendMessage', '1002:test-capture-bot-token')
      .at(-1)?.payload as { text: string };
    expect(reply.text).toContain(content('sr').captureBot.contacts.hours);
    expect(reply.text).toContain(formatPhone(PHONE_NUMBER));
    expect(reply.text).toContain(SITE_URL);
  });
});

describe('the CarLab Questionnaire', () => {
  it('asks a visitor with no username for the phone last, with no skip, and takes a typed number', async () => {
    const words = content('ru').captureBot;

    await press('request:ru:diagnostics', NO_HANDLE);
    await answer('Golf 2012, стучит подвеска', NO_HANDLE);
    await answer('064 123 4567', NO_HANDLE);

    expect(questions(NO_HANDLE)).toEqual([
      words.lookingFor,
      words.phoneAsk,
      words.thanks,
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

  it('asks a visitor with a username about the car and what happened, never a budget or the phone', async () => {
    const words = content('ru').captureBot;

    await press('request:ru:diagnostics');
    await answer('Golf 2012, стучит подвеска');

    expect(questions()).toEqual([words.lookingFor, words.thanks]);
    expect(visitorLead()).toMatchObject({
      service: 'diagnostics',
      comment: 'Машина и проблема: Golf 2012, стучит подвеска',
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
    expect(offered).toEqual(['ru', 'sr', 'en']);
  });
});
