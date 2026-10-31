import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContactClickRoute } from './contactClick.ts';

const notifyLead = vi.fn().mockResolvedValue(undefined);
const waitUntil = vi.fn();

const POST = createContactClickRoute({
  notifyLead,
  waitUntil,
  isLocale: (v: string) => ['ru', 'sr', 'en'].includes(v),
  defaultLocale: 'ru',
});

const VISITOR_ID = '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11';

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries({ visitor_id: VISITOR_ID, ...fields }).forEach(([k, v]) =>
    formData.append(k, v),
  );
  return {
    request: new Request('http://localhost/api/contact-click', {
      method: 'POST',
      body: formData,
    }),
  };
}

describe('createContactClickRoute', () => {
  beforeEach(() => {
    notifyLead.mockReset().mockResolvedValue(undefined);
    waitUntil.mockReset();
  });

  it('returns 204', async () => {
    const res = await POST(makeCtx({ channel: 'phone', source_url: '/ru/' }));
    expect(res.status).toBe(204);
  });

  it('refuses an oversized body before reading it', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/contact-click', {
        method: 'POST',
        headers: { 'content-length': '70000' },
        body: 'x',
      }),
    });
    expect(response.status).toBe(413);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('refuses a body that is not a form without storing a click', async () => {
    const response = await POST({
      request: new Request('http://localhost/api/contact-click', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      }),
    });

    expect(response.status).toBe(400);
    expect(notifyLead).not.toHaveBeenCalled();
  });

  it('defaults to phone when no channel is given', async () => {
    await POST(makeCtx({ source_url: '/ru/' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        contactChannel: 'phone',
        kind: 'call_click',
        name: '',
        locale: 'ru',
      }),
      '[contact-click]',
    );
  });

  it('dispatches notifyLead via waitUntil with the clicked channel', async () => {
    await POST(makeCtx({ channel: 'telegram', source_url: '/ru/' }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'call_click',
        name: '',
        contact: '—',
        contactChannel: 'telegram',
        service: '',
        services: [],
      }),
      '[contact-click]',
    );
  });

  it.each(['whatsapp', 'viber'] as const)(
    'records the clicked channel for %s and leaves the service to the pages that know one',
    async (channel) => {
      await POST(makeCtx({ channel, source_url: '/ru/' }));
      const call = notifyLead.mock.calls.at(-1)![0];
      expect(call.contactChannel).toBe(channel);
      expect(call.service).toBe('');
    },
  );

  it.each(['sms', 'constructor', 'toString', 'hasOwnProperty'])(
    'falls back to phone for an unrecognized/prototype-key channel (%s)',
    async (channel) => {
      await POST(makeCtx({ channel, source_url: '/ru/' }));
      expect(notifyLead).toHaveBeenCalledWith(
        expect.objectContaining({
          service: '',
          services: [],
          contactChannel: 'phone',
        }),
        '[contact-click]',
      );
    },
  );

  it('takes the locale from the first segment of an absolute source_url', async () => {
    await POST(
      makeCtx({
        channel: 'phone',
        source_url: 'http://localhost/sr/usluge/',
      }),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'sr' }),
      '[contact-click]',
    );
  });

  it('falls back to the default locale for a source_url with no path at all', async () => {
    await POST(makeCtx({ channel: 'phone', source_url: 'http://localhost' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'ru' }),
      '[contact-click]',
    );
  });

  it('passes visitor_id through as visitorId', async () => {
    await POST(makeCtx({ channel: 'phone', source_url: '/ru/' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: VISITOR_ID }),
      '[contact-click]',
    );
  });

  it('passes the Meta ids through as metaIds', async () => {
    const metaIds = { fbp: 'fb.1.1596403881668.1116446470' };
    await POST(
      makeCtx({ channel: 'telegram', meta_ids: JSON.stringify(metaIds) }),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ metaIds }),
      '[contact-click]',
    );
  });

  it('passes the ad visit through as adSource', async () => {
    const adSource = {
      source: 'google',
      campaign: 'brakes',
      at: '2026-10-01T10:00:00.000Z',
    };
    await POST(
      makeCtx({ channel: 'whatsapp', ad_source: JSON.stringify(adSource) }),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ adSource }),
      '[contact-click]',
    );
  });

  it('sends null for a missing source_url rather than an empty string', async () => {
    await POST(makeCtx({ channel: 'phone' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        source_url: null,
        adSource: null,
        metaIds: null,
      }),
      '[contact-click]',
    );
  });

  it.each([
    `http://localhost/ru/${'a'.repeat(9000)}`,
    'https://evil.example/ru/',
    'javascript:alert(1)',
  ])('stores no page for %s', async (source_url) => {
    await POST(makeCtx({ channel: 'phone', source_url }));
    expect(notifyLead.mock.calls.at(-1)![0].source_url).toBeNull();
  });

  it.each(['', 'b'.repeat(5000)])(
    'stores no click without a visitor id this site could have issued (%#)',
    async (visitor_id) => {
      const response = await POST(makeCtx({ channel: 'phone', visitor_id }));
      expect(response.status).toBe(204);
      expect(notifyLead).not.toHaveBeenCalled();
    },
  );

  it('returns 204 without waiting for notifyLead to resolve', async () => {
    let resolveNotify!: () => void;
    notifyLead.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveNotify = resolve;
      }),
    );

    const res = await POST(makeCtx({ channel: 'phone', source_url: '/ru/' }));

    expect(res.status).toBe(204);
    resolveNotify();
  });
});
