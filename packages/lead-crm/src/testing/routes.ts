import './database.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backgroundIdle } from '../background.ts';
import type { StoredLead } from '../schema.ts';
import { recordBotApi } from './botApi.ts';

export interface RouteSuite {
  brand: string;
  POST: (context: never) => Response | Promise<Response>;
  readLeads(): Promise<StoredLead[]>;
}

export interface LeadsRouteSuite extends RouteSuite {
  fields?: Record<string, string>;
  stored?: Partial<StoredLead>;
}

const VISITOR_ID = '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11';

function postedTo(path: string, POST: RouteSuite['POST']) {
  const api = recordBotApi();
  let previousFetch: typeof fetch;
  beforeEach(() => {
    api.reset();
    previousFetch = globalThis.fetch;
    vi.stubGlobal('fetch', api.fetch);
  });
  afterEach(() => {
    vi.stubGlobal('fetch', previousFetch);
  });
  return {
    async post(fields: Record<string, string>): Promise<Response> {
      const response = await POST({
        request: new Request(`http://localhost${path}`, {
          method: 'POST',
          headers: { origin: 'http://localhost' },
          body: new URLSearchParams(fields),
        }),
        redirect: (location: string, status = 302) =>
          new Response(null, { status, headers: { location } }),
        cookies: { get: () => undefined },
      } as never);
      await backgroundIdle();
      return response;
    },
    groupCards: () =>
      api
        .callsTo('sendMessage', process.env.TELEGRAM_BOT_TOKEN!)
        .filter(
          ({ payload }) =>
            String(payload.chat_id) === process.env.TELEGRAM_GROUP_ID,
        ),
  };
}

export function testContactClickRoute({ brand, POST, readLeads }: RouteSuite) {
  describe('a contact click posted to /api/contact-click', () => {
    const { post, groupCards } = postedTo('/api/contact-click', POST);
    const click = (visitorId: string) =>
      post({
        channel: 'whatsapp',
        source_url: 'http://localhost/en/services/',
        visitor_id: visitorId,
      });

    it(`stores a ${brand} click Lead and posts its card to the CRM group`, async () => {
      expect((await click(VISITOR_ID)).status).toBe(204);
      expect(await readLeads()).toEqual([
        expect.objectContaining({
          brand,
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
      expect((await click('')).status).toBe(204);
      expect(await readLeads()).toEqual([]);
      expect(groupCards()).toEqual([]);
    });
  });
}

export function testLeadsRoute({
  brand,
  POST,
  readLeads,
  fields = {},
  stored = {},
}: LeadsRouteSuite) {
  describe('a lead posted to /api/leads', () => {
    const { post, groupCards } = postedTo('/api/leads', POST);
    const form = (extra: Record<string, string>) =>
      post({
        contact: '+381601234567',
        contact_channel: 'whatsapp',
        name: 'Ana',
        locale: 'sr',
        source_url: 'http://localhost/sr/',
        visitor_id: '',
        ...fields,
        ...extra,
      });

    it(`stores the Lead as ${brand} and posts its card to the CRM group`, async () => {
      const response = await form({});

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toMatch(/^\/sr\//);
      expect(await readLeads()).toEqual([
        expect.objectContaining({
          brand,
          contact: '+381601234567',
          ...stored,
        }),
      ]);
      expect(groupCards()).toHaveLength(1);
    });

    it('stores nothing for a form without a contact', async () => {
      const response = await form({ contact: '', locale: '' });

      expect(response.status).not.toBe(302);
      expect(await readLeads()).toEqual([]);
      expect(groupCards()).toEqual([]);
    });
  });
}
