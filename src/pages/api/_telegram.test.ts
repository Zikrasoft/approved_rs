import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/telegram', () => ({
  editGroupMessage: vi.fn().mockResolvedValue(undefined),
  answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './telegram';
import { editGroupMessage, answerCallbackQuery } from '../../lib/telegram';

const SECRET = 'test-webhook-secret';

function makeCtx(body: object, includeSecret = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (includeSecret) headers['x-telegram-bot-api-secret-token'] = SECRET;
  return {
    request: new Request('http://localhost/api/telegram', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  } as any;
}

const baseCallbackQuery = {
  id: 'cq_test',
  from: { username: 'manager1' },
  message: { message_id: 999, text: '🚗 Заявка #42 — Автоподбор\n\nИмя: Иван' },
};

describe('POST /api/telegram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when secret token is missing', async () => {
    const ctx = makeCtx({ callback_query: { ...baseCallbackQuery, data: 'accept:42' } }, false);
    const res = await POST(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 for accept callback', async () => {
    const ctx = makeCtx({ callback_query: { ...baseCallbackQuery, data: 'accept:42' } });
    const res = await POST(ctx);
    expect(res.status).toBe(200);
  });

  it('calls editGroupMessage with message_id and username', async () => {
    const ctx = makeCtx({ callback_query: { ...baseCallbackQuery, data: 'accept:42' } });
    await POST(ctx);
    expect(editGroupMessage).toHaveBeenCalledWith(
      999,
      baseCallbackQuery.message.text,
      'manager1',
      'in_progress'
    );
  });

  it('calls answerCallbackQuery to dismiss spinner', async () => {
    const ctx = makeCtx({ callback_query: { ...baseCallbackQuery, data: 'close:42' } });
    await POST(ctx);
    expect(answerCallbackQuery).toHaveBeenCalledWith('cq_test');
  });

  it('ignores non-callback_query updates (returns 200)', async () => {
    const ctx = makeCtx({ message: { text: '/start', from: { username: 'user1' } } });
    const res = await POST(ctx);
    expect(res.status).toBe(200);
    expect(editGroupMessage).not.toHaveBeenCalled();
  });

  it('returns 200 even when Telegram update throws', async () => {
    vi.mocked(editGroupMessage).mockRejectedValueOnce(new Error('TG error'));
    const ctx = makeCtx({ callback_query: { ...baseCallbackQuery, data: 'accept:42' } });
    const res = await POST(ctx);
    expect(res.status).toBe(200);
  });
});
