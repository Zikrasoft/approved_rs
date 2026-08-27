import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}));
vi.mock('../../lib/notifyLead', () => ({
  notifyLead: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./leads";
import { waitUntil } from '@vercel/functions';
import { notifyLead } from '@/lib/notifyLead';

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  const redirectFn = vi.fn((url: string, status: number) =>
    new Response(null, { status, headers: { Location: url } })
  );
  return {
    request: new Request('http://localhost/api/leads', { method: 'POST', body: formData }),
    redirect: redirectFn,
    cookies: { get: () => undefined },
  } as any;
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    vi.mocked(notifyLead).mockResolvedValue(undefined);
    vi.mocked(waitUntil).mockReset();
  });

  it('redirects to /ru/thanks/ on valid data', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing' });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });

  it('returns 400 when name is empty', async () => {
    const ctx = makeCtx({ name: '', contact: '@ivan', service: 'vehicle-sourcing' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact is missing', async () => {
    const ctx = makeCtx({ name: 'Иван', service: 'vehicle-sourcing' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('dispatches notifyLead via waitUntil with parsed form fields and locale', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-buyback', country: 'de', source_url: '/ru/vehicle-buyback/de/' });
    await POST(ctx);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Иван', contact: '@ivan', service: 'vehicle-buyback', country: 'de', locale: 'ru',
      }),
      '[leads]'
    );
  });

  it('passes visitor_id through as visitorId', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing', visitor_id: 'abc-123' });
    await POST(ctx);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ visitorId: 'abc-123' }),
      '[leads]'
    );
  });

  it('redirects without waiting for notifyLead to resolve', async () => {
    let resolveNotify!: () => void;
    vi.mocked(notifyLead).mockReturnValue(new Promise(resolve => { resolveNotify = resolve; }));
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing' });

    await POST(ctx);

    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
    resolveNotify();
  });
});
