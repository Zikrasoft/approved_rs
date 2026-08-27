import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}));
vi.mock('../../lib/notifyLead', () => ({
  notifyLead: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './contact-click';
import { waitUntil } from '@vercel/functions';
import { notifyLead } from '@/lib/notifyLead';

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  return {
    request: new Request('http://localhost/api/contact-click', { method: 'POST', body: formData }),
  } as any;
}

describe('POST /api/contact-click', () => {
  beforeEach(() => {
    vi.mocked(notifyLead).mockResolvedValue(undefined);
    vi.mocked(waitUntil).mockReset();
  });

  it('returns 204', async () => {
    const res = await POST(makeCtx({ channel: 'phone', source_url: '/ru/vehicle-sourcing/de/' }));
    expect(res.status).toBe(204);
  });

  it('defaults to phone wording when no channel is given', async () => {
    await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ contactChannel: 'phone', service: 'Звонок с сайта', kind: 'call_click', name: '' }),
      '[contact-click]'
    );
  });

  it('dispatches notifyLead via waitUntil with the clicked channel and an empty name', async () => {
    await POST(makeCtx({ channel: 'telegram', source_url: '/ru/vehicle-sourcing/de/' }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'call_click',
        name: '',
        contactChannel: 'telegram',
        service: 'Клик Telegram с сайта',
      }),
      '[contact-click]'
    );
  });

  it.each(['whatsapp', 'viber'] as const)('builds channel-specific wording for %s', async (channel) => {
    await POST(makeCtx({ channel, source_url: '/ru/' }));
    const call = vi.mocked(notifyLead).mock.calls.at(-1)![0];
    expect(call.contactChannel).toBe(channel);
    expect(call.service).toContain(channel === 'whatsapp' ? 'WhatsApp' : 'Viber');
  });

  it.each(['sms', 'constructor', 'toString', 'hasOwnProperty'])(
    'falls back to phone wording for an unrecognized/prototype-key channel (%s)',
    async (channel) => {
      await POST(makeCtx({ channel, source_url: '/ru/' }));
      expect(notifyLead).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'Звонок с сайта', contactChannel: 'phone' }),
        '[contact-click]'
      );
    }
  );

  it('passes visitor_id through as visitorId', async () => {
    await POST(makeCtx({ channel: 'phone', source_url: '/ru/', visitor_id: 'abc-123' }));
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: 'abc-123' }),
      '[contact-click]'
    );
  });

  it('returns 204 without waiting for notifyLead to resolve', async () => {
    let resolveNotify!: () => void;
    vi.mocked(notifyLead).mockReturnValue(new Promise(resolve => { resolveNotify = resolve; }));

    const res = await POST(makeCtx({ channel: 'phone', source_url: '/ru/vehicle-sourcing/de/' }));

    expect(res.status).toBe(204);
    resolveNotify();
  });
});
