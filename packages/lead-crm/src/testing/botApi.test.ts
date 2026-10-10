import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTelegramClient } from '../telegram/client.ts';
import { recordBotApi } from './botApi.ts';

describe('recordBotApi', () => {
  it('records each call with its token, method and payload', async () => {
    const api = recordBotApi();
    const sent = await api.fetch(
      'https://api.telegram.org/botTOKEN/sendMessage',
      {
        method: 'POST',
        body: JSON.stringify({ chat_id: 5, text: 'hi' }),
      },
    );
    expect(await sent.json()).toMatchObject({
      ok: true,
      result: { message_id: 1000, chat: { id: 5 }, text: 'hi' },
    });
    expect(api.callsTo('sendMessage', 'TOKEN')).toEqual([
      {
        token: 'TOKEN',
        method: 'sendMessage',
        payload: { chat_id: 5, text: 'hi' },
      },
    ]);
    expect(api.callsTo('sendMessage', 'OTHER')).toEqual([]);
  });

  it('answers getMe, edits and other methods with plausible defaults', async () => {
    const api = recordBotApi();
    const me = await api.fetch(
      new Request('https://api.telegram.org/botT/getMe'),
    );
    expect(await me.json()).toMatchObject({ result: { is_bot: true } });
    const edit = await api.fetch(
      'https://api.telegram.org/botT/editMessageText',
      {
        body: JSON.stringify({ chat_id: 1, message_id: 7 }),
      },
    );
    expect(await edit.json()).toMatchObject({ result: { message_id: 7 } });
    const answer = await api.fetch(
      new URL('https://api.telegram.org/botT/answerCallbackQuery'),
    );
    expect(await answer.json()).toEqual({ ok: true, result: true });
  });

  it('serves canned results and failures, and resets them', async () => {
    const api = recordBotApi();
    api.respond('getChat', { id: 9 });
    api.respond('sendMessage', (p: Record<string, unknown>) => ({
      ok: true,
      result: { echoed: p.text },
    }));
    api.fail('editMessageText', 'Bad Request: message is not modified');
    const res = await api.fetch('https://api.telegram.org/botT/getChat');
    expect(await res.json()).toEqual({ ok: true, result: { id: 9 } });
    const echoed = await api.fetch(
      'https://api.telegram.org/botT/sendMessage',
      {
        body: JSON.stringify({ text: 'x' }),
      },
    );
    expect(await echoed.json()).toEqual({ ok: true, result: { echoed: 'x' } });
    const failed = await api.fetch(
      'https://api.telegram.org/botT/editMessageText',
    );
    expect(failed.status).toBe(400);
    api.reset();
    expect(api.calls).toEqual([]);
    const after = await api.fetch('https://api.telegram.org/botT/getChat');
    expect(await after.json()).toEqual({ ok: true, result: true });
  });

  it('answers a numeric chat id sent as a string with a number, as Telegram does', async () => {
    const api = recordBotApi();
    const send = (chatId: string) =>
      api
        .fetch('https://api.telegram.org/botT/sendMessage', {
          body: JSON.stringify({ chat_id: chatId }),
        })
        .then((res) => res.json());
    expect(await send('-100500')).toMatchObject({
      result: { chat: { id: -100500 } },
    });
    expect(await send('@channel')).toMatchObject({
      result: { chat: { id: '@channel' } },
    });
  });

  it('rejects a URL that is not a Bot API method', async () => {
    await expect(recordBotApi().fetch('https://example.com/')).rejects.toThrow(
      'not a Bot API URL',
    );
  });
});

describe('recordBotApi as the global fetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sees what the Telegram client sends and surfaces a failure as an error', async () => {
    const api = recordBotApi();
    vi.stubGlobal('fetch', api.fetch);
    const client = createTelegramClient('TOKEN', 'test_bot');
    await client.sendMessage(42, 'hello');
    expect(api.callsTo('sendMessage')[0].payload).toMatchObject({
      chat_id: 42,
      text: 'hello',
    });
    api.fail('answerCallbackQuery', 'Bad Request: query is too old');
    await expect(client.answerCallback('q')).rejects.toThrow(
      'query is too old',
    );
  });

  it('serves a voice file through getFile and the file download URL', async () => {
    const api = recordBotApi();
    vi.stubGlobal('fetch', api.fetch);
    const client = createTelegramClient('TOKEN', 'test_bot');
    const voice = new Uint8Array([1, 2, 3]);
    api.serveFile('voice-1', voice);

    await expect(client.downloadFile('voice-1')).resolves.toEqual(voice);
    expect(api.callsTo('getFile')[0].payload).toEqual({ file_id: 'voice-1' });

    api.reset();
    await expect(client.downloadFile('voice-1')).rejects.toThrow(
      'file download failed: 404',
    );
    api.respond('getFile', { file_id: 'voice-1', file_unique_id: 'u' });
    await expect(client.downloadFile('voice-1')).rejects.toThrow('has no path');
  });
});
