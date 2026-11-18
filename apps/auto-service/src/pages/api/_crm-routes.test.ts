import '@podbor/lead-crm/testing/database';
import { describe, expect, it, vi } from 'vitest';
import { recordBotApi } from '@podbor/lead-crm/testing';
import { POST } from './telegram-webhook';
import { GET } from './reminders';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

describe('the CRM bot routes carlab.rs hosts', () => {
  it('answers a Telegram update carrying the webhook secret', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/telegram-webhook', {
        method: 'POST',
        headers: { 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
        body: JSON.stringify({ update_id: 1 }),
      }),
    });
    expect(response.status).toBe(200);
  });

  it('refuses an update without the webhook secret', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/telegram-webhook', {
        method: 'POST',
        body: '{}',
      }),
    });
    expect(response.status).toBe(401);
  });

  it('runs the reminders for the cron secret alone', async () => {
    const refused = await GET({
      request: new Request('http://localhost/api/reminders'),
    });
    expect(refused.status).toBe(401);

    const ran = await GET({
      request: new Request('http://localhost/api/reminders', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    });
    expect(ran.status).toBe(200);
    expect(await ran.json()).toEqual({
      expiredGhosts: 0,
      closedTopics: 0,
      digestSent: false,
    });
  });
});
