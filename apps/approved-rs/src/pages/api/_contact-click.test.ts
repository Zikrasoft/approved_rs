import '@podbor/lead-crm/testing/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordBotApi } from '@podbor/lead-crm/testing';

const pending = vi.hoisted(() => [] as Promise<unknown>[]);

vi.mock('@podbor/site-kit/background', () => ({
  inBackground: (promise: Promise<unknown>) => pending.push(promise),
}));

import { POST } from './contact-click';
import { leadStore } from '@/lib/crm';

const api = recordBotApi();
vi.stubGlobal('fetch', api.fetch);

const GROUP_ID = '-1009876543210';
const VISITOR_ID = '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11';

const click = (fields: Record<string, string>) =>
  POST({
    request: new Request('http://localhost/api/contact-click', {
      method: 'POST',
      body: new URLSearchParams({
        channel: 'whatsapp',
        source_url: 'http://localhost/en/services/',
        ...fields,
      }),
    }),
  } as unknown as Parameters<typeof POST>[0]);

const groupCards = () =>
  api
    .callsTo('sendMessage', '1001:test-bot-token')
    .filter(({ payload }) => payload.chat_id === GROUP_ID);

beforeEach(() => {
  api.reset();
  pending.length = 0;
});

describe('a contact click posted to /api/contact-click', () => {
  it('stores an Approved.rs click Lead and posts its card to the CRM group', async () => {
    const response = await click({ visitor_id: VISITOR_ID });
    await Promise.all(pending);

    expect(response.status).toBe(204);
    expect(await leadStore.readLeads()).toEqual([
      expect.objectContaining({
        brand: 'Approved.rs',
        kind: 'call_click',
        contactChannel: 'whatsapp',
        visitorId: VISITOR_ID,
        locale: 'en',
        source_url: 'http://localhost/en/services/',
      }),
    ]);
    expect(groupCards()).toHaveLength(1);
  });

  it('stores nothing for a click without a visitor id', async () => {
    const response = await click({ visitor_id: '' });
    await Promise.all(pending);

    expect(response.status).toBe(204);
    expect(await leadStore.readLeads()).toEqual([]);
    expect(groupCards()).toEqual([]);
  });
});
