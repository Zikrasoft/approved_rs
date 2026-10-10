import { describe, expect, it, vi } from 'vitest';
import { LEADS_PATH } from '@podbor/lead-crm';
import { recordBotApi, type MemoryStorage } from '@podbor/lead-crm/testing';

const memory = vi.hoisted(() => {
  const storages = new Map<string, MemoryStorage>();
  return {
    storages,
    async module(name: string) {
      const { createMemoryStorage } = await import('@podbor/lead-crm/testing');
      const storageAt = ({ path }: { path: string }) => {
        if (!storages.has(path)) storages.set(path, createMemoryStorage());
        return storages.get(path)!;
      };
      return { [name]: storageAt };
    },
  };
});

vi.mock('@podbor/lead-crm/storage/vercel-blob', () =>
  memory.module('createVercelBlobStorage'),
);
vi.mock('@podbor/lead-crm/storage/file', () =>
  memory.module('createFileStorage'),
);

import { POST } from './telegram-capture';
import { content } from '@/i18n/content';
import { SITE_URL } from '@/utils/constants';

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

function answer(text: string) {
  return visitorUpdate({
    message: {
      message_id: 2,
      chat: { id: VISITOR.id, type: 'private' },
      from: VISITOR,
      text,
    },
  });
}

function press(data: string) {
  return visitorUpdate({
    callback_query: {
      id: 'tap',
      from: VISITOR,
      chat_instance: 'chat',
      data,
      message: {
        message_id: 3,
        date: 0,
        chat: { id: VISITOR.id, type: 'private' },
      },
    },
  });
}

function questions(): unknown[] {
  return api
    .callsTo('sendMessage', 'test-capture-bot-token')
    .filter((call) => call.payload.chat_id === VISITOR.id)
    .map((call) => call.payload.text);
}

function visitorLead() {
  return (
    memory.storages.get(LEADS_PATH)?.current() as { telegramId: number }[]
  ).find((lead) => lead.telegramId === VISITOR.id);
}

describe('the Details capture bot', () => {
  it('opens a service card from the services content, in Serbian', async () => {
    await start('polishing-ceramic_sr');

    const { services, captureBot } = content('sr');
    const reply = api.callsTo('sendMessage', 'test-capture-bot-token').at(-1)
      ?.payload as { text: string; reply_markup: unknown };
    expect(reply.text).toContain(services['polishing-ceramic'].short);
    expect(reply.text).toContain(services['polishing-ceramic'].priceFrom);
    expect(reply.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: captureBot.card.request,
            callback_data: 'request:sr:polishing-ceramic',
          },
        ],
        [
          {
            text: captureBot.card.site,
            url: new URL('/sr/services/polishing-ceramic/', SITE_URL).href,
          },
        ],
        [{ text: captureBot.menu.back, callback_data: 'services:sr' }],
      ],
    });
    expect(memory.storages.get(LEADS_PATH)?.current()).toEqual([
      expect.objectContaining({
        brand: 'Details',
        service: 'polishing-ceramic',
        locale: 'sr',
      }),
    ]);
  });
});

describe('the Details Questionnaire', () => {
  it('asks for the car, the service as buttons, then the phone', async () => {
    const words = content('ru').captureBot;

    await press('request:ru');
    await answer('Audi A6 2019');
    await press('pick:ru:polishing-ceramic');
    await answer(words.phoneSkip);

    expect(questions()).toEqual([
      words.request.car,
      words.request.service,
      words.phoneOffer,
      words.thanks,
    ]);
    expect(visitorLead()).toMatchObject({
      service: 'polishing-ceramic',
      comment: 'Машина: Audi A6 2019',
      capturePrompt: null,
    });
  });

  it('skips the service question when the card already named one', async () => {
    const words = content('ru').captureBot;
    api.reset();

    await answer('/start');
    await press('request:ru:polishing-ceramic');
    await answer('Audi A6 2019');

    expect(questions().slice(1)).toEqual([words.request.car, words.phoneOffer]);
  });
});
