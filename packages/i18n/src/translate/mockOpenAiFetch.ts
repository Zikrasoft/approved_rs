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

const CYRILLIC_LETTERS = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const LATIN_LETTERS = 'abvgdeejziiklmnoprstufhccssjyjeuy';

export const latin = (text: string): string =>
  text.replace(/\p{Script=Cyrillic}/gu, (letter) => {
    const lower = letter.toLowerCase();
    const swapped = LATIN_LETTERS.charAt(CYRILLIC_LETTERS.indexOf(lower));
    return letter === lower ? swapped : swapped.toUpperCase();
  });

export function stubTranslate(transform: (text: string) => string): void {
  stubOpenAiFetch((content) =>
    Object.fromEntries(
      Object.entries(JSON.parse(content) as Record<string, string>).map(
        ([path, text]) => [path, latin(transform(text))],
      ),
    ),
  );
}

function sentMessages(index: 0 | 1): string[] {
  return (
    fetch as unknown as { mock: { calls: [string, { body: string }][] } }
  ).mock.calls.map(
    (call) =>
      (JSON.parse(call[1].body) as { messages: { content: string }[] })
        .messages[index]!.content,
  );
}

export const systemPrompts = (): string[] => sentMessages(0);

export const sentPayloads = (): Record<string, string>[] =>
  sentMessages(1).map(
    (content) => JSON.parse(content) as Record<string, string>,
  );
