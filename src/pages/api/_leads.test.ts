import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/db', () => ({
  insertLead: vi.fn(),
  updateLeadTgMessageId: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/telegram', () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(999),
}));

import { POST } from "./leads";
import { insertLead, updateLeadTgMessageId } from "../../lib/db";
import { sendLeadNotification } from "../../lib/telegram";

const mockLead = {
  id: 42, name: 'Иван', contact: '@ivan', service: 'autopodbor',
  comment: null, country: 'de', city: null, source_url: null,
  status: 'new' as const, tg_message_id: null, handled_by: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  const redirectFn = vi.fn((url: string, status: number) =>
    new Response(null, { status, headers: { Location: url } })
  );
  return {
    request: new Request('http://localhost/api/leads', { method: 'POST', body: formData }),
    redirect: redirectFn,
  } as any;
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    vi.mocked(insertLead).mockResolvedValue(mockLead);
    vi.mocked(sendLeadNotification).mockResolvedValue(999);
  });

  it('redirects to /thanks/ on valid data', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'autopodbor' });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/thanks/', 302);
  });

  it('returns 400 when name is empty', async () => {
    const ctx = makeCtx({ name: '', contact: '@ivan', service: 'autopodbor' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact is missing', async () => {
    const ctx = makeCtx({ name: 'Иван', service: 'autopodbor' });
    const res = await POST(ctx);
    expect(res.status).toBe(400);
  });

  it('calls insertLead with parsed form fields', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'delivery', country: 'de', source_url: '/de/dostavka/' });
    await POST(ctx);
    expect(insertLead).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Иван', contact: '@ivan', service: 'delivery', country: 'de',
    }));
  });

  it('stores tg_message_id after notification', async () => {
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'autopodbor' });
    await POST(ctx);
    expect(updateLeadTgMessageId).toHaveBeenCalledWith(42, 999);
  });

  it('still redirects when Telegram notification throws', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));
    const ctx = makeCtx({ name: 'Иван', contact: '@ivan', service: 'autopodbor' });
    await POST(ctx);
    expect(ctx.redirect).toHaveBeenCalledWith('/thanks/', 302);
  });
});
