import { vi } from 'vitest';

// The OpenAI SDK reads real Response semantics (`.headers`, single-read
// body) off whatever global `fetch` returns — a plain `{ ok, json() }` mock
// object throws inside the SDK's own response handling. Shared by every
// translate-*.test.ts that stubs fetch to fake a chat-completion response.
export function openAiChatResponse(contentObj: unknown): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(contentObj) } }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export function openAiErrorResponse(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Stubs global fetch to return a fixed chat-completion response, once per
// test — the common case (translate-cases.test.ts's/translate-i18n.test.ts's
// `mockResponse`).
export function stubOpenAiResponse(contentObj: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => openAiChatResponse(contentObj)),
  );
}

// Stubs global fetch to echo back whatever `transform` returns for the
// request's user-message content — simulates "OpenAI translated the
// source" without a real API call.
export function stubOpenAiFetch(
  transform: (userContent: string) => unknown,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body as string) as {
        messages: { content: string }[];
      };
      return openAiChatResponse(transform(body.messages[1].content));
    }),
  );
}
