import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContactClickRoute } from './contactClick.ts';

const notifyLead = vi.fn().mockResolvedValue(undefined);
const waitUntil = vi.fn();

const POST = createContactClickRoute({
  notifyLead,
  waitUntil,
  defaultLocale: 'ru',
});

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
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

  it('defaults to phone wording when no channel is given', async () => {
    await POST(makeCtx({ source_url: '/ru/' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        contactChannel: 'phone',
        service: 'Звонок с сайта',
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
        service: 'Клик Telegram с сайта',
      }),
      '[contact-click]',
    );
  });

  it.each(['whatsapp', 'viber'] as const)(
    'builds channel-specific wording for %s',
    async (channel) => {
      await POST(makeCtx({ channel, source_url: '/ru/' }));
      const call = notifyLead.mock.calls.at(-1)![0];
      expect(call.contactChannel).toBe(channel);
      expect(call.service).toContain(
        channel === 'whatsapp' ? 'WhatsApp' : 'Viber',
      );
    },
  );

  it.each(['sms', 'constructor', 'toString', 'hasOwnProperty'])(
    'falls back to phone wording for an unrecognized/prototype-key channel (%s)',
    async (channel) => {
      await POST(makeCtx({ channel, source_url: '/ru/' }));
      expect(notifyLead).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'Звонок с сайта',
          contactChannel: 'phone',
        }),
        '[contact-click]',
      );
    },
  );

  it('passes visitor_id through as visitorId', async () => {
    await POST(
      makeCtx({ channel: 'phone', source_url: '/ru/', visitor_id: 'abc-123' }),
    );
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: 'abc-123' }),
      '[contact-click]',
    );
  });

  it('sends null for a missing source_url rather than an empty string', async () => {
    await POST(makeCtx({ channel: 'phone' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ source_url: null, visitorId: null }),
      '[contact-click]',
    );
  });

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
