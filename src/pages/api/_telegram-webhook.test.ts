import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/telegram', () => ({
  updateLeadStatus: vi.fn().mockResolvedValue(undefined),
  answerCallback: vi.fn().mockResolvedValue(undefined),
  isLeadStatusKey: (key: string) => ['in_progress', 'won', 'lost'].includes(key),
}));

import { POST } from './telegram-webhook';
import { updateLeadStatus, answerCallback } from '@/lib/telegram';

const SECRET = 'test-webhook-secret';

function makeCtx(body: unknown, headers: Record<string, string> = { 'x-telegram-bot-api-secret-token': SECRET }) {
  return {
    request: new Request('http://localhost/api/telegram-webhook', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  } as any;
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(() => {
    vi.mocked(updateLeadStatus).mockReset().mockResolvedValue(undefined);
    vi.mocked(answerCallback).mockReset().mockResolvedValue(undefined);
  });

  it('rejects a request without the secret token header', async () => {
    const res = await POST(makeCtx({}, {}));
    expect(res.status).toBe(401);
    expect(updateLeadStatus).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret token', async () => {
    const res = await POST(makeCtx({}, { 'x-telegram-bot-api-secret-token': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('updates lead status and acks the callback on a valid status callback', async () => {
    const res = await POST(makeCtx({
      callback_query: {
        id: 'cb-1',
        data: 'st:won',
        message: { message_id: 555, text: 'Статус: Новая', chat: { id: -100123 } },
      },
    }));

    expect(res.status).toBe(200);
    expect(updateLeadStatus).toHaveBeenCalledWith(-100123, 555, 'Статус: Новая', 'won');
    expect(answerCallback).toHaveBeenCalledWith('cb-1', 'Статус обновлён');
  });

  it('acks with an error message and does not throw if updateLeadStatus fails', async () => {
    vi.mocked(updateLeadStatus).mockRejectedValueOnce(new Error('Telegram down'));
    const res = await POST(makeCtx({
      callback_query: { id: 'cb-2', data: 'st:lost', message: { message_id: 1, text: 'Статус: Новая', chat: { id: 1 } } },
    }));

    expect(res.status).toBe(200);
    expect(answerCallback).toHaveBeenCalledWith('cb-2', 'Ошибка, попробуйте ещё раз');
  });

  it('acks an unrecognized callback without calling updateLeadStatus', async () => {
    const res = await POST(makeCtx({
      callback_query: { id: 'cb-3', data: 'unknown:thing', message: { message_id: 1, text: '', chat: { id: 1 } } },
    }));

    expect(res.status).toBe(200);
    expect(updateLeadStatus).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith('cb-3');
  });

  it('acks without updating when the status prefix is valid but the key is not an allowlisted status', async () => {
    const res = await POST(makeCtx({
      callback_query: { id: 'cb-4', data: 'st:bogus', message: { message_id: 1, text: 'Статус: Новая', chat: { id: 1 } } },
    }));

    expect(res.status).toBe(200);
    expect(updateLeadStatus).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith('cb-4');
  });

  it('acks without updating when a valid status is sent with no message attached', async () => {
    const res = await POST(makeCtx({
      callback_query: { id: 'cb-5', data: 'st:won' },
    }));

    expect(res.status).toBe(200);
    expect(updateLeadStatus).not.toHaveBeenCalled();
    expect(answerCallback).toHaveBeenCalledWith('cb-5');
  });

  it('returns 200 for updates with no callback_query (e.g. plain messages)', async () => {
    const res = await POST(makeCtx({ message: { text: 'hi' } }));
    expect(res.status).toBe(200);
    expect(answerCallback).not.toHaveBeenCalled();
  });
});
