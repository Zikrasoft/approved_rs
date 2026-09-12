import type { StoredLead } from '../schema.ts';
import { expectMessageAndChatId, type TelegramClient } from './client.ts';
import {
  commissionClaimText,
  commissionResultText,
  dealNotificationText,
  statusChangeText,
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
  async function sendToAll(
    ids: number[],
    text: string,
    extra?: object,
  ): Promise<void> {
    await Promise.all(ids.map((id) => client.sendMessage(id, text, extra)));
  }

  return {
    async sendLeadNotification(
      lead: StoredLead,
    ): Promise<{ chatId: number; messageId: number }> {
      const sent = await client.tgPost('sendMessage', {
        chat_id: groupId,
        text: formatter.formatTeaser(lead),
        parse_mode: 'HTML',
        reply_markup: formatter.deepLinkKeyboard(lead.id),
      });
      const { messageId, chatId } = expectMessageAndChatId(sent, 'sendMessage');

      try {
        await client.tgPost('pinChatMessage', {
          chat_id: chatId,
          message_id: messageId,
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
        // Telegram refuses the edit outright once the message is deleted or
        // too old to touch — there is no card left to refresh.
        if (
          err instanceof Error &&
          /message to edit not found|message can't be edited/.test(err.message)
        )
          return false;
        throw err;
      }
      return true;
    },

    async sendDealNotificationToAdmin(lead: StoredLead): Promise<void> {
      if (lead.dealAmount == null) return;
      await sendToAll(
        adminIds,
        dealNotificationText({ ...lead, dealAmount: lead.dealAmount }),
      );
    },

    async sendCommissionClaimToAdmin(lead: StoredLead): Promise<void> {
      if (!lead.pendingCommissionClaim) return;
      await sendToAll(
        adminIds,
        commissionClaimText({
          ...lead,
          pendingCommissionClaim: lead.pendingCommissionClaim,
        }),
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Подтвердить',
                  callback_data: `confirmpay:${lead.id}`,
                },
                { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
              ],
            ],
          },
        },
      );
    },

    async sendCommissionResultToOwner(
      lead: StoredLead,
      confirmed: boolean,
    ): Promise<void> {
      await sendToAll(ownerIds, commissionResultText(lead.id, confirmed));
    },

    async sendStatusChangeToAdmin(lead: StoredLead): Promise<void> {
      await sendToAll(adminIds, statusChangeText(lead));
    },

    async sendPostponeReminderToOwner(lead: StoredLead): Promise<void> {
      const results = await Promise.allSettled(
        ownerIds.map((id) =>
          client.tgPost('sendMessage', {
            chat_id: id,
            text: formatter.postponeReminderText(lead),
            parse_mode: 'HTML',
            reply_markup: formatter.deepLinkKeyboard(lead.id),
          }),
        ),
      );
      if (results.length > 0 && results.every((r) => r.status === 'rejected')) {
        throw (results[0] as PromiseRejectedResult).reason;
      }
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
