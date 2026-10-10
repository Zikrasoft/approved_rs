import type { LedgerOperation } from '../ledgerStore.ts';
import { isClosed, type StoredLead } from '../schema.ts';
import type { Digest } from '../store.ts';
import { isMessageGone, type TelegramClient } from './client.ts';
import {
  operationNoticeText,
  quarantinedLeadsText,
  statusChangeText,
  type EditField,
  type FieldChangeAuthor,
  type Formatter,
  type Role,
} from './format.ts';

export interface NotifierOptions {
  client: TelegramClient;
  formatter: Formatter;
  groupId: string;
  ownerIds: number[];
  adminIds: number[];
}

export function createNotifier({
  client,
  formatter,
  groupId,
  ownerIds,
  adminIds,
}: NotifierOptions) {
  async function sendToAll(ids: number[], text: string): Promise<void> {
    await Promise.all(ids.map((id) => client.sendMessage(id, text)));
  }

  return {
    async sendLeadNotification(
      lead: StoredLead,
    ): Promise<{ chatId: number; messageId: number }> {
      const sent = await client.api.sendMessage(
        groupId,
        formatter.formatTeaser(lead),
        {
          parse_mode: 'HTML',
          reply_markup: formatter.deepLinkKeyboard(lead.id),
        },
      );
      const messageId = sent.message_id;
      const chatId = sent.chat.id;
      if (isClosed(lead)) return { chatId, messageId };

      try {
        await client.api.pinChatMessage(chatId, messageId, {
          disable_notification: true,
        });
      } catch (err) {
        console.error('[telegram] pinChatMessage failed', {
          error: err,
          messageId,
        });
      }

      return { chatId, messageId };
    },

    async unpinLeadCard(lead: StoredLead): Promise<void> {
      if (lead.telegramChatId == null || lead.telegramMessageId == null) return;
      try {
        await client.api.unpinChatMessage(
          lead.telegramChatId,
          lead.telegramMessageId,
        );
      } catch (err) {
        console.error('[telegram] unpinChatMessage failed', {
          error: err,
          messageId: lead.telegramMessageId,
        });
      }
    },

    async refreshLeadCard(lead: StoredLead): Promise<boolean> {
      if (lead.telegramChatId == null || lead.telegramMessageId == null)
        return false;
      try {
        await client.safeEditMessage(
          lead.telegramChatId,
          lead.telegramMessageId,
          formatter.formatTeaser(lead),
          formatter.deepLinkKeyboard(lead.id),
        );
      } catch (err) {
        if (isMessageGone(err)) return false;
        throw err;
      }
      return true;
    },

    async sendOperationNotice(
      operation: LedgerOperation,
      balance: number,
      authorId: number,
    ): Promise<void> {
      const others = new Set([...ownerIds, ...adminIds]);
      others.delete(authorId);
      await sendToAll([...others], operationNoticeText(operation, balance));
    },

    async sendFieldChangeToAdmin(
      lead: StoredLead,
      field: EditField,
      before: string | null | undefined,
      author?: FieldChangeAuthor,
    ): Promise<void> {
      if ((before ?? '') === (lead[field] ?? '')) return;
      await sendToAll(
        adminIds,
        formatter.fieldChangeText(lead, field, before, author),
      );
    },

    async sendQuarantinedLeadsToAdmin(
      count: number,
      path: string,
      brand: string,
    ): Promise<void> {
      await sendToAll(adminIds, quarantinedLeadsText(count, path, brand));
    },

    async sendStatusChangeToAdmin(lead: StoredLead): Promise<void> {
      await sendToAll(adminIds, statusChangeText(lead));
    },

    async sendDigest(digest: Digest): Promise<boolean> {
      const message = formatter.digestMessage(digest);
      if (!message) return false;
      await client.sendMessage(groupId, message.text, {
        reply_markup: message.reply_markup,
      });
      return true;
    },

    async editLeadDetailMessage(
      chatId: number,
      messageId: number,
      lead: StoredLead,
      role: Role,
    ): Promise<void> {
      const { text, reply_markup } = formatter.buildLeadDetail(lead, role);
      await client.safeEditMessage(chatId, messageId, text, reply_markup);
    },
  };
}

export type Notifier = ReturnType<typeof createNotifier>;
