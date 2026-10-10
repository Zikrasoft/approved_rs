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

function tap(data: string) {
  return POST({
    request: new Request('http://localhost/api/telegram-capture', {
      method: 'POST',
      headers: {
        'x-telegram-bot-api-secret-token': 'test-capture-webhook-secret',
      },
      body: JSON.stringify({
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
      }),
    }),
  });
}

describe('the CarLab capture bot', () => {
  it('opens a service card from the services content, in Serbian', async () => {
    await start('diagnostics_sr');

    const { services, captureBot } = content('sr');
    const reply = api.callsTo('sendMessage', 'test-capture-bot-token').at(-1)
      ?.payload as { text: string; reply_markup: unknown };
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
      }),
    ]);
  });

  it('sends the workshop venue, then hours, phone and site', async () => {
    api.reset();
    await tap('contacts:sr');

    expect(api.callsTo('sendVenue', 'test-capture-bot-token')).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          latitude: WORKSHOP_ADDRESS.lat,
          longitude: WORKSHOP_ADDRESS.lon,
        }),
      }),
    ]);
    const reply = api.callsTo('sendMessage', 'test-capture-bot-token').at(-1)
      ?.payload as { text: string };
    expect(reply.text).toContain(content('sr').captureBot.contacts.hours);
    expect(reply.text).toContain(formatPhone(PHONE_NUMBER));
    expect(reply.text).toContain(SITE_URL);
  });
});
