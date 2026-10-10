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

describe('the Approved capture bot', () => {
  it('opens a service hub card from the services content, in Serbian', async () => {
    await start('vehicle-import_sr');

    const { services, captureBot } = content('sr');
    const reply = api.callsTo('sendMessage', 'test-capture-bot-token').at(-1)
      ?.payload as { text: string; reply_markup: unknown };
    const { hub } = services['vehicle-import'];
    expect(reply.text).toContain(`<b>${hub.title} ${hub.titleHighlight}</b>`);
    expect(reply.text).toContain(hub.description);
    expect(reply.reply_markup).toEqual({
      inline_keyboard: [
        [
          {
            text: captureBot.card.request,
            callback_data: 'request:sr:vehicle-import',
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
      }),
    ]);
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

    const reply = api.callsTo('sendMessage', 'test-capture-bot-token').at(-1)
      ?.payload as {
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
