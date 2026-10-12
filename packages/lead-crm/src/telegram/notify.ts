import type { LedgerOperation } from '../ledgerStore.ts';
import { isClosed, type StoredLead } from '../schema.ts';
import type { Digest } from '../store.ts';
import { isMessageGone, type TelegramClient } from './client.ts';
import { operationNoticeText, unreadableLedgerText } from './ledger.ts';
import {
  contactNoteText,
  fieldChangeText,
  quarantinedLeadsText,
  statusChangeText,
  type EditField,
  type Formatter,
} from './cards.ts';
import type { Role } from './markup.ts';

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
    const sent = await Promise.allSettled(
      ids.map((id) => client.sendMessage(id, text)),
    );
    sent.forEach((result, at) => {
      if (result.status === 'rejected')
        console.error('[telegram] a staff notice was not delivered', {
          error: result.reason,
          chatId: ids[at],
        });
    });
  }

  function otherRole(by: Role, authorId: number): number[] {
    return (by === 'owner' ? adminIds : ownerIds).filter(
      (id) => id !== authorId,
    );
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
          reply_markup: formatter.deepLinkKeyboard(lead),
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

    async openLeadTopic(lead: StoredLead): Promise<number> {
      const topic = await client.api.createForumTopic(
        groupId,
        formatter.topicName(lead),
      );
      return topic.message_thread_id;
    },

    async deleteLeadTopic(topicId: number): Promise<void> {
      await client.api.deleteForumTopic(groupId, topicId);
    },

    async renameLeadTopic(lead: StoredLead): Promise<void> {
      if (lead.topicId == null) return;
      try {
        await client.api.editForumTopic(groupId, lead.topicId, {
          name: formatter.topicName(lead),
        });
      } catch (err) {
        console.error('[telegram] editForumTopic failed', {
          error: err,
          topicId: lead.topicId,
        });
      }
    },

    async postLeadTopicSummary(
      lead: StoredLead,
      topicId: number,
    ): Promise<number> {
      const sent = await client.api.sendMessage(
        groupId,
        formatter.topicSummaryText(lead),
        { parse_mode: 'HTML', message_thread_id: topicId },
      );
      return sent.message_id;
    },

    async refreshLeadTopic(lead: StoredLead): Promise<void> {
      if (lead.topicMessageId == null) return;
      await client.api.editMessageText(
        groupId,
        lead.topicMessageId,
        formatter.topicSummaryText(lead),
        { parse_mode: 'HTML' },
      );
    },

    async closeLeadTopic(lead: StoredLead): Promise<void> {
      if (lead.topicId == null) return;
      await client.api.closeForumTopic(groupId, lead.topicId);
    },

    async reopenLeadTopic(lead: StoredLead): Promise<void> {
      if (lead.topicId == null) return;
      await client.api.reopenForumTopic(groupId, lead.topicId);
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
          formatter.deepLinkKeyboard(lead),
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

    async sendQuarantinedLeadsToAdmin(
      count: number,
      path: string,
      brand: string,
    ): Promise<void> {
      await sendToAll(adminIds, quarantinedLeadsText(count, path, brand));
    },

    async sendUnreadableLedgerToAdmin(
      path: string,
      brand: string,
    ): Promise<void> {
      await sendToAll(adminIds, unreadableLedgerText(path, brand));
    },

    async sendStatusChangeToAdmin(lead: StoredLead): Promise<void> {
      await sendToAll(adminIds, statusChangeText(lead));
    },

    async sendFieldChange(
      lead: StoredLead,
      field: EditField,
      before: string,
      by: Role,
      authorId: number,
    ): Promise<void> {
      if (before === lead[field]) return;
      await sendToAll(
        otherRole(by, authorId),
        fieldChangeText(lead, field, before, by),
      );
    },

    async sendContactNote(
      lead: StoredLead,
      contact: string,
      by: Role,
      authorId: number,
    ): Promise<void> {
      await sendToAll(
        otherRole(by, authorId),
        contactNoteText(lead, contact, by),
      );
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
