import { vi } from 'vitest';

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

export function stubOpenAiResponse(contentObj: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => openAiChatResponse(contentObj)),
  );
}

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
