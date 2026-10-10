import { Bot, GrammyError, type Api, type Transformer } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { Keyboard } from './format.ts';

export type SendExtra = Parameters<Api['sendMessage']>[2];

export function parseIds(value: string | undefined): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

export function isMessageGone(err: unknown): boolean {
  return (
    err instanceof GrammyError &&
    /message to edit not found|message can't be edited/.test(err.description)
  );
}

const ignoreNotModified: Transformer = async (
  prev,
  method,
  payload,
  signal,
) => {
  const response = await prev(method, payload, signal);
  if (
    method === 'editMessageText' &&
    !response.ok &&
    response.description.includes('message is not modified')
  )
    return { ok: true, result: true as never };
  return response;
};

function staticBotInfo(botToken: string, username: string): UserFromGetMe {
  return {
    id: Number(botToken.split(':', 1)[0]),
    is_bot: true,
    first_name: username,
    username,
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };
}

export function createTelegramClient(botToken: string, botUsername: string) {
  const bot = new Bot(botToken, {
    botInfo: staticBotInfo(botToken, botUsername),
    client: {
      fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    },
  });
  bot.api.config.use(ignoreNotModified);
  const { api } = bot;

  return {
    bot,
    api,

    async safeEditMessage(
      chatId: number,
      messageId: number,
      text: string,
      keyboard: Keyboard,
    ): Promise<void> {
      await api.editMessageText(chatId, messageId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    },

    async sendMessage(
      chatId: number | string,
      text: string,
      extra?: SendExtra,
    ): Promise<void> {
      await api.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra });
    },

    async sendForceReplyPrompt(chatId: number, text: string): Promise<number> {
      const sent = await api.sendMessage(chatId, text, {
        reply_markup: { force_reply: true, selective: true },
      });
      return sent.message_id;
    },

    async answerCallback(
      callbackQueryId: string,
      text?: string,
    ): Promise<void> {
      await api.answerCallbackQuery(callbackQueryId, { text });
    },
  };
}

export type TelegramClient = ReturnType<typeof createTelegramClient>;
