import { BotError, GrammyError, type Context } from 'grammy';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError } from './logError.ts';

const NAME = 'Petar Petrovic';
const CONTACT = '+381641234567';

const telegramError = () =>
  new GrammyError(
    "Call to 'sendMessage' failed!",
    { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
    'sendMessage',
    { chat_id: 1, text: `${NAME} ${CONTACT}` },
  );

const logged = () => {
  const spy = vi.mocked(console.error);
  return JSON.stringify(spy.mock.calls);
};

describe('logError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs a Telegram error by method, code and description only', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('[x] failed', telegramError(), { leadId: 7 });
    expect(console.error).toHaveBeenCalledWith('[x] failed', {
      leadId: 7,
      error: {
        method: 'sendMessage',
        error_code: 400,
        description: 'Bad Request: chat not found',
      },
    });
    expect(logged()).not.toContain(CONTACT);
    expect(logged()).not.toContain(NAME);
  });

  it('unwraps a middleware error without logging the update', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = { update: { message: { text: `${NAME} ${CONTACT}` } } };
    logError('[x] failed', new BotError(telegramError(), ctx as Context));
    expect(logged()).toContain('sendMessage');
    expect(logged()).not.toContain(CONTACT);
    expect(logged()).not.toContain(NAME);
  });

  it('logs any other error by name and message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('[x] failed', new TypeError('boom'));
    expect(console.error).toHaveBeenCalledWith('[x] failed', {
      error: { name: 'TypeError', message: 'boom' },
    });
  });

  it('logs only the type of a thrown non-error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('[x] failed', { contact: CONTACT });
    expect(logged()).not.toContain(CONTACT);
  });
});
