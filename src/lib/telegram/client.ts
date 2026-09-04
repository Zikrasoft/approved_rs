// Low-level Telegram Bot API access — HTTP calls and their response
// shape-checks. Nothing here knows what a lead is; format.ts/notify.ts do.

function requireEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`[telegram] ${name} is not set`);
  return value;
}

export const BOT_TOKEN = requireEnv(
  'TELEGRAM_BOT_TOKEN',
  import.meta.env.TELEGRAM_BOT_TOKEN,
);
export const GROUP_ID = requireEnv(
  'TELEGRAM_GROUP_ID',
  import.meta.env.TELEGRAM_GROUP_ID,
);
export const BOT_USERNAME = requireEnv(
  'TELEGRAM_BOT_USERNAME',
  import.meta.env.TELEGRAM_BOT_USERNAME,
);
// Comma-separated — someone can have more than one Telegram account.
export function parseIds(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

export const OWNER_IDS = parseIds(import.meta.env.TELEGRAM_OWNER_ID);
export const ADMIN_IDS = parseIds(import.meta.env.TELEGRAM_ADMIN_ID);

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function tgPost(method: string, body: object): Promise<unknown> {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as {
    result: unknown;
    description?: string;
  };
  if (!response.ok) {
    throw new Error(
      `Telegram ${method} failed: ${response.status} ${data.description ?? ''}`.trim(),
    );
  }
  return data.result;
}

export function expectMessageId(sent: unknown, context: string): number {
  const messageId = (sent as { message_id?: unknown } | null)?.message_id;
  if (typeof messageId !== 'number')
    throw new Error(`[telegram] ${context} response missing message_id`);
  return messageId;
}

export function expectMessageAndChatId(
  sent: unknown,
  context: string,
): { messageId: number; chatId: number } {
  const result = sent as {
    message_id?: unknown;
    chat?: { id?: unknown };
  } | null;
  const chatId = result?.chat?.id;
  if (typeof chatId !== 'number')
    throw new Error(`[telegram] ${context} response missing chat.id`);
  return { messageId: expectMessageId(sent, context), chatId };
}

// A double-tap's "message is not modified" isn't a real failure.
export async function safeEditMessage(
  chatId: number,
  messageId: number,
  text: string,
  keyboard: object,
): Promise<void> {
  try {
    await tgPost('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('message is not modified'))
      return;
    throw err;
  }
}

export async function sendMessage(
  chatId: number | string,
  text: string,
  extra?: object,
): Promise<void> {
  await tgPost('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export async function sendForceReplyPrompt(
  chatId: number,
  text: string,
): Promise<number> {
  const sent = await tgPost('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { force_reply: true, selective: true },
  });
  return expectMessageId(sent, 'force-reply prompt');
}

export async function answerCallback(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await tgPost('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}
