import '@podbor/lead-crm/testing/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordBotApi } from '@podbor/lead-crm/testing';

const pending = vi.hoisted(() => [] as Promise<unknown>[]);

vi.mock('@podbor/site-kit/background', () => ({
  inBackground: (promise: Promise<unknown>) => pending.push(promise),
}));

import { POST } from './leads';
import { leadStore } from '@/lib/crm';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const GROUP_ID = '-1009876543210';

const post = (body: URLSearchParams) =>
  POST({
    request: new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body,
    }),
    redirect: (path: string, status = 302) =>
      new Response(null, { status, headers: { location: path } }),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  api.reset();
  pending.length = 0;
});

describe('a lead posted to /api/leads', () => {
  it('stores the Lead as Details and posts its card to the CRM group', async () => {
    const response = await post(
      new URLSearchParams({
        contact: '+381601234567',
        contact_channel: 'whatsapp',
        name: 'Ana',
        locale: 'sr',
        source_url: 'https://details.rs/sr/',
        visitor_id: '',
      }),
    );
    await Promise.all(pending);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/sr/thanks/');
    expect(await leadStore.readLeads()).toEqual([
      expect.objectContaining({ brand: 'Details', contact: '+381601234567' }),
    ]);
    expect(
      api
        .callsTo('sendMessage', '1001:test-bot-token')
        .filter(({ payload }) => payload.chat_id === GROUP_ID),
    ).toHaveLength(1);
  });
});
