import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  openAiChatResponse,
  openAiErrorResponse,
  stubOpenAiResponse,
  stubOpenAiFetch,
} from './mockOpenAiFetch';

describe('openAiChatResponse', () => {
  it('builds a real Response the OpenAI SDK can parse', async () => {
    const response = openAiChatResponse({ x: 1 });
    expect(response.ok).toBe(true);
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(JSON.parse(data.choices[0].message.content)).toEqual({ x: 1 });
  });
});

describe('openAiErrorResponse', () => {
  it('builds a real, non-ok Response with the given status/message', async () => {
    const response = openAiErrorResponse('boom', 500);
    expect(response.ok).toBe(false);
    expect(response.status).toBe(500);
    const data = (await response.json()) as { error: { message: string } };
    expect(data.error.message).toBe('boom');
  });
});

describe('stubOpenAiResponse / stubOpenAiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stubOpenAiResponse makes every fetch call return the same content', async () => {
    stubOpenAiResponse({ x: 1 });
    const r1 = await fetch('https://api.openai.com/v1/chat/completions');
    const r2 = await fetch('https://api.openai.com/v1/chat/completions');
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it('stubOpenAiFetch transforms the request body into the response content', async () => {
    stubOpenAiFetch((userContent) => ({ echoed: userContent }));
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ messages: [{}, { content: 'hello' }] }),
    });
    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    expect(JSON.parse(data.choices[0].message.content)).toEqual({
      echoed: 'hello',
    });
  });
});
