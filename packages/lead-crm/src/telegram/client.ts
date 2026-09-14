export interface TelegramCredentials {
  botToken: string;
  groupId: string;
  botUsername: string;
  ownerIds: number[];
  adminIds: number[];
}

export function parseIds(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
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

export function createTelegramClient(botToken: string) {
  const api = `https://api.telegram.org/bot${botToken}`;

  async function tgPost(method: string, body: object): Promise<unknown> {
    const response = await fetch(`${api}/${method}`, {
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

  return {
    tgPost,

    async safeEditMessage(
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
        if (
          err instanceof Error &&
          err.message.includes('message is not modified')
        )
          return;
        throw err;
      }
    },

    async sendMessage(
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
    },

    async sendForceReplyPrompt(chatId: number, text: string): Promise<number> {
      const sent = await tgPost('sendMessage', {
        chat_id: chatId,
        text,
        reply_markup: { force_reply: true, selective: true },
      });
      return expectMessageId(sent, 'force-reply prompt');
    },

    async answerCallback(
      callbackQueryId: string,
      text?: string,
    ): Promise<void> {
      await tgPost('answerCallbackQuery', {
        callback_query_id: callbackQueryId,
        text,
      });
    },
  };
}

export type TelegramClient = ReturnType<typeof createTelegramClient>;
