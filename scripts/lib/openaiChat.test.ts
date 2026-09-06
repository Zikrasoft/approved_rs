import { describe, it, expect, vi, afterEach } from 'vitest';
import { callOpenAiJson, TARGET_LANGUAGE_NAME } from './openaiChat';

describe('TARGET_LANGUAGE_NAME', () => {
  it('has an entry for every translatable locale', () => {
    expect(Object.keys(TARGET_LANGUAGE_NAME).sort()).toEqual([
      'de',
      'en',
      'es',
      'sr',
    ]);
  });
});

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
        choices: [{ message: { content: JSON.stringify({ x: 1 }) } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callOpenAiJson({
      apiKey: 'test-key',
      systemPrompt: 'sys',
      userContent: 'user',
    });
    expect(result).toEqual({ x: 1 });

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
    // maxRetries defaults to 2 — a 500 is retried (with real backoff delays,
    // hence this test taking ~1.3s), so every call must fail the same way
    // for the final rejection to surface this message.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () =>
          jsonResponse({ error: { message: 'boom' } }, 500),
        ),
    );
    await expect(
      callOpenAiJson({ apiKey: 'k', systemPrompt: 's', userContent: 'u' }),
    ).rejects.toThrow(/boom/);
  });

  it('throws when the response has no message content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: {} }] })),
    );
    await expect(
      callOpenAiJson({ apiKey: 'k', systemPrompt: 's', userContent: 'u' }),
    ).rejects.toThrow(/missing content/);
  });
});
