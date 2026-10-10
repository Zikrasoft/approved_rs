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

    const edit = api.callsTo('editMessageText', 'test-capture-bot-token').at(-1)
      ?.payload as { text: string; reply_markup: unknown };
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
