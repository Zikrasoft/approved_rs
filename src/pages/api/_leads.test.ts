import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/telegram', () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./leads";
import { sendLeadNotification } from "@/lib/telegram";

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
    vi.mocked(sendLeadNotification).mockResolvedValue(undefined);
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

  it('calls sendLeadNotification with parsed form fields', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-buyback', country: 'de', source_url: '/ru/vehicle-buyback/de/' });
    await POST(ctx);
    expect(sendLeadNotification).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Иван', contact: '@ivan', service: 'vehicle-buyback', country: 'de',
    }));
  });

  it('still redirects when Telegram notification throws', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'vehicle-sourcing' });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/ru/thanks/', 302);
  });
});
