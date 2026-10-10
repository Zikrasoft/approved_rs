import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import type { StoredLead } from '@/lib/store';

vi.mock('@/lib/store', () => ({
  getDuePostponed: vi.fn(),
  resumeLead: vi.fn(),
  expireGhostLeads: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({
  sendPostponeReminderToOwner: vi.fn(),
  afterStatusChange: vi.fn(),
}));

import { GET } from './reminders';
import { expireGhostLeads, getDuePostponed, resumeLead } from '@/lib/store';
import { sendPostponeReminderToOwner, afterStatusChange } from '@/lib/telegram';

const SECRET = 'test-cron-secret';

function makeCtx(
  headers: Record<string, string> = { authorization: `Bearer ${SECRET}` },
) {
  return {
    request: new Request('http://localhost/api/reminders', { headers }),
  } as Pick<APIContext, 'request'> as APIContext;
}

function makeLead(overrides: Partial<StoredLead> = {}): StoredLead {
  return {
    id: 1,
    brand: 'Approved.rs',
    name: 'Иван',
    contact: '@ivan',
    service: 'vehicle-sourcing',
    services: ['vehicle-sourcing'],
    locale: 'ru',
    status: 'postponed',
    dealAmount: null,
    commissionPercent: 10,
    paidAmount: 0,
    incomes: [],
    payments: [],
    telegramChatId: -100123,
    telegramMessageId: 555,
    statusChangedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    pendingPrompt: null,
    capturePrompt: null,
    telegramId: null,
    referredBy: null,
    archived: false,
    pendingCommissionClaim: null,
    remindAt: '2026-01-01',
    postponedFrom: null,
    ...overrides,
  };
}

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.mocked(getDuePostponed).mockReset().mockResolvedValue([]);
    vi.mocked(resumeLead)
      .mockReset()
      .mockResolvedValue(undefined as unknown as StoredLead);
    vi.mocked(sendPostponeReminderToOwner)
      .mockReset()
      .mockResolvedValue(undefined);
    vi.mocked(afterStatusChange).mockReset().mockResolvedValue(undefined);
    vi.mocked(expireGhostLeads).mockReset().mockResolvedValue([]);
  });

  it('rejects a request without a matching bearer token', async () => {
    const res = await GET(makeCtx({}));
    expect(res.status).toBe(401);
    expect(getDuePostponed).not.toHaveBeenCalled();
  });

  it('rejects the wrong bearer token', async () => {
    const res = await GET(makeCtx({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('rejects a header missing the "Bearer " scheme entirely', async () => {
    const res = await GET(makeCtx({ authorization: SECRET }));
    expect(res.status).toBe(401);
    expect(getDuePostponed).not.toHaveBeenCalled();
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

  it('sends the due-date reminder to the owner, resumes the lead, and refreshes its card with the admin notice', async () => {
    vi.mocked(getDuePostponed).mockResolvedValue([makeLead({ id: 9 })]);
    const resumed = makeLead({ id: 9, status: 'in_progress', remindAt: null });
    vi.mocked(resumeLead).mockResolvedValue(resumed);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(sendPostponeReminderToOwner).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9 }),
    );
    expect(resumeLead).toHaveBeenCalledWith(9);
    expect(afterStatusChange).toHaveBeenCalledWith(resumed);
    expect(vi.mocked(afterStatusChange).mock.calls[0][1]).toBeUndefined();
    expect(await res.json()).toEqual({
      remindedPostponed: 1,
      expiredGhosts: 0,
    });
  });

  it('does not try to refresh the card when resumeLead no-ops (e.g. lead already moved on)', async () => {
    vi.mocked(getDuePostponed).mockResolvedValue([makeLead({ id: 9 })]);
    vi.mocked(resumeLead).mockResolvedValue(undefined);

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(afterStatusChange).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({
      remindedPostponed: 1,
      expiredGhosts: 0,
    });
  });

  it('skips resuming a postponed lead whose reminder send failed, but still processes the next one', async () => {
    vi.mocked(getDuePostponed).mockResolvedValue([
      makeLead({ id: 9 }),
      makeLead({ id: 10 }),
    ]);
    vi.mocked(sendPostponeReminderToOwner).mockRejectedValueOnce(
      new Error('down'),
    );

    const res = await GET(makeCtx());

    expect(res.status).toBe(200);
    expect(resumeLead).toHaveBeenCalledTimes(1);
    expect(resumeLead).toHaveBeenCalledWith(10);
    expect(await res.json()).toEqual({
      remindedPostponed: 1,
      expiredGhosts: 0,
    });
  });

  it('sweeps ghost leads and refreshes each archived card without a notice', async () => {
    const ghost = makeLead({ id: 7, status: 'lost', archived: true });
    vi.mocked(expireGhostLeads).mockResolvedValue([ghost]);

    const res = await GET(makeCtx());

    expect(expireGhostLeads).toHaveBeenCalledWith(expect.any(Date));
    expect(afterStatusChange).toHaveBeenCalledWith(ghost, { notice: false });
    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 1,
    });
  });

  it('still counts a swept ghost whose card refresh failed', async () => {
    vi.mocked(expireGhostLeads).mockResolvedValue([
      makeLead({ id: 7, archived: true }),
      makeLead({ id: 8, archived: true }),
    ]);
    vi.mocked(afterStatusChange).mockRejectedValueOnce(new Error('down'));

    const res = await GET(makeCtx());

    expect(afterStatusChange).toHaveBeenCalledTimes(2);
    expect(await res.json()).toEqual({
      remindedPostponed: 0,
      expiredGhosts: 2,
    });
  });
});
