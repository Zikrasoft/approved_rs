import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import type { StoredLead } from '@/lib/store';

vi.mock('@/lib/store', () => ({
  getStaleLeads: vi.fn(),
  markReminded: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({
  sendReminderMessage: vi.fn(),
}));

import { GET } from './reminders';
import { getStaleLeads, markReminded } from '@/lib/store';
import { sendReminderMessage } from '@/lib/telegram';

const SECRET = 'test-cron-secret';
const OWNER_ID = 111;
const ADMIN_ID = 222;

function makeCtx(headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return {
    request: new Request('http://localhost/api/reminders', { headers }),
  } as Pick<APIContext, 'request'> as APIContext;
}

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 1,
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    locale: 'ru',
    status: 'in_progress',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    payments: [],
    telegramChatId: -100123,
    telegramMessageId: 555,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    lastRemindedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    archived: false,
    pendingCommissionClaim: null,
    ...overrides,
  };
}

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.mocked(getStaleLeads).mockReset().mockResolvedValue([]);
    vi.mocked(markReminded).mockReset().mockResolvedValue(undefined as unknown as StoredLead);
    vi.mocked(sendReminderMessage).mockReset().mockResolvedValue(undefined);
  });

  it('rejects a request without a matching bearer token', async () => {
    const res = await GET(makeCtx({}));
    expect(res.status).toBe(401);
    expect(getStaleLeads).not.toHaveBeenCalled();
  });

  it('rejects the wrong bearer token', async () => {
    const res = await GET(makeCtx({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('rejects a header missing the "Bearer " scheme entirely', async () => {
    const res = await GET(makeCtx({ authorization: SECRET }));
    expect(res.status).toBe(401);
    expect(getStaleLeads).not.toHaveBeenCalled();
  });

  it('rejects a different auth scheme (e.g. Basic)', async () => {
    const res = await GET(makeCtx({ authorization: `Basic ${SECRET}` }));
    expect(res.status).toBe(401);
  });

  it('rejects an empty Authorization header', async () => {
    const res = await GET(makeCtx({ authorization: '' }));
    expect(res.status).toBe(401);
  });

  it('rejects "Bearer " with no token after it', async () => {
    const res = await GET(makeCtx({ authorization: 'Bearer ' }));
    expect(res.status).toBe(401);
  });

  it('DMs both owner and admin per stale lead, then marks it, using LEAD_STALE_DAYS from env', async () => {
    vi.mocked(getStaleLeads).mockResolvedValue([makeLead({ id: 7 })]);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(getStaleLeads).toHaveBeenCalledWith(5);
    expect(sendReminderMessage).toHaveBeenCalledTimes(2);
    expect(sendReminderMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), OWNER_ID);
    expect(sendReminderMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), ADMIN_ID);
    expect(markReminded).toHaveBeenCalledWith(7);
  });

  it('skips marking a lead whose send failed, but still processes the next lead, and reports only real successes', async () => {
    vi.mocked(getStaleLeads).mockResolvedValue([makeLead({ id: 7 }), makeLead({ id: 8 })]);
    vi.mocked(sendReminderMessage).mockRejectedValueOnce(new Error('down')); // lead 7's owner DM fails

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    // lead 7: 1 attempted call (failed, aborts that lead's remaining sends+mark); lead 8: 2 calls
    expect(sendReminderMessage).toHaveBeenCalledTimes(3);
    expect(markReminded).toHaveBeenCalledTimes(1);
    expect(markReminded).toHaveBeenCalledWith(8);
    // reminded must reflect only lead 8's real success, not stale.length (2)
    expect(await res.json()).toEqual({ reminded: 1 });
  });
});
