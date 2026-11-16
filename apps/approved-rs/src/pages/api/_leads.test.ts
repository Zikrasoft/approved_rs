import '@podbor/lead-crm/testing/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARTNER_SERVICE } from '@podbor/brands';
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

const post = (fields: Record<string, string>) =>
  POST({
    request: new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { origin: 'http://localhost' },
      body: new URLSearchParams({
        contact: '+381601234567',
        contact_channel: 'whatsapp',
        name: 'Ana',
        locale: 'sr',
        source_url: 'http://localhost/sr/',
        visitor_id: '',
        ...fields,
      }),
    }),
    redirect: (path: string, status = 302) =>
      new Response(null, { status, headers: { location: path } }),
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof POST>[0]);

const groupCards = () =>
  api
    .callsTo('sendMessage', '1001:test-bot-token')
    .filter(({ payload }) => payload.chat_id === GROUP_ID);

beforeEach(() => {
  api.reset();
  pending.length = 0;
});

describe('a lead posted to /api/leads', () => {
  it('stores the Lead as Approved.rs and posts its card to the CRM group', async () => {
    const response = await post({ service: 'vehicle-sourcing' });
    await Promise.all(pending);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/sr/thanks/');
    expect(await leadStore.readLeads()).toEqual([
      expect.objectContaining({
        brand: 'Approved.rs',
        contact: '+381601234567',
        service: 'vehicle-sourcing',
      }),
    ]);
    expect(groupCards()).toHaveLength(1);
  });

  it('stores a Lead sent through the partner block as the partner brand', async () => {
    await post({ service: PARTNER_SERVICE.carlab });
    await Promise.all(pending);

    expect(await leadStore.readLeads()).toEqual([
      expect.objectContaining({
        brand: 'CarLab',
        source_url: 'http://localhost/sr/',
      }),
    ]);
    expect(groupCards()).toHaveLength(1);
  });

  it('stores nothing for a form without a contact', async () => {
    const response = await post({ contact: '' });
    await Promise.all(pending);

    expect(response.status).not.toBe(302);
    expect(await leadStore.readLeads()).toEqual([]);
    expect(groupCards()).toEqual([]);
  });
});
