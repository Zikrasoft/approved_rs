import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  callOpenAiJson,
  OPENAI_TIMEOUT_MS,
  OPENAI_MAX_RETRIES,
  TranslateResponseError,
} from './openaiChat';

describe('callOpenAiJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('posts model/response_format/messages and returns the parsed content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: JSON.stringify({ x: 'y' }) } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenAiJson({
      apiKey: 'test-key',
      systemPrompt: 'sys',
      userContent: 'user',
      chunk: 'c',
    });
    expect(result).toEqual({ x: 'y' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'user' },
    ]);
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer test-key',
    );
  });

  it('throws with the API error message when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () =>
          jsonResponse({ error: { message: 'boom' } }, 500),
        ),
    );
    await expect(
      callOpenAiJson({
        apiKey: 'k',
        systemPrompt: 's',
        userContent: 'u',
        chunk: 'c',
      }),
    ).rejects.toThrow(/boom/);
  });

  it('retries exactly once, matching OPENAI_MAX_RETRIES', async () => {
    expect(OPENAI_MAX_RETRIES).toBe(1);
    expect(OPENAI_TIMEOUT_MS).toBe(60_000);
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({}, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callOpenAiJson({
        apiKey: 'k',
        systemPrompt: 's',
        userContent: 'u',
        chunk: 'c',
      }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(OPENAI_MAX_RETRIES + 1);
  });

  it('throws when the response has no message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: {} }] })),
    );
    await expect(
      callOpenAiJson({
        apiKey: 'k',
        systemPrompt: 's',
        userContent: 'u',
        chunk: 'c',
      }),
    ).rejects.toThrow(/missing content/);
  });

  it.each([
    ['a list', ['x']],
    ['a nested value', { x: { y: 'z' } }],
    ['a number', { x: 1 }],
  ])(
    'throws a typed error naming the chunk when the content is %s',
    async (_label, content) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({
            choices: [{ message: { content: JSON.stringify(content) } }],
          }),
        ),
      );
      const call = callOpenAiJson({
        apiKey: 'k',
        systemPrompt: 's',
        userContent: 'u',
        chunk: 'home.sr',
      });
      await expect(call).rejects.toBeInstanceOf(TranslateResponseError);
      await expect(call).rejects.toMatchObject({ chunk: 'home.sr' });
      await expect(call).rejects.toThrow(/"home.sr" is malformed/);
    },
  );
});
