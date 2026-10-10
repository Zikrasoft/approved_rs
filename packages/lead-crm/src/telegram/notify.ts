import type { Income, StoredLead } from '../schema.ts';
import {
  isMessageGone,
  type SendExtra,
  type TelegramClient,
} from './client.ts';
import {
  commissionClaimText,
  commissionResultText,
  dealNotificationText,
  incomeNotificationText,
  fieldChangeText,
  quarantinedLeadsText,
  statusChangeText,
  type EditField,
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
    extra?: SendExtra,
  ): Promise<void> {
    await Promise.all(ids.map((id) => client.sendMessage(id, text, extra)));
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

    async sendDealNotificationToAdmin(lead: StoredLead): Promise<void> {
      if (lead.dealAmount == null) return;
      await sendToAll(
        adminIds,
        dealNotificationText({ ...lead, dealAmount: lead.dealAmount }),
      );
    },

    async sendIncomeNotificationToAdmin(
      lead: StoredLead,
      income: Income,
    ): Promise<void> {
      await sendToAll(adminIds, incomeNotificationText(lead, income));
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

    async sendFieldChangeToAdmin(
      lead: StoredLead,
      field: EditField,
      before: string | null | undefined,
    ): Promise<void> {
      if ((before ?? '') === (lead[field] ?? '')) return;
      await sendToAll(adminIds, fieldChangeText(lead, field, before));
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

    async sendPostponeReminderToOwner(lead: StoredLead): Promise<void> {
      const results = await Promise.allSettled(
        ownerIds.map((id) =>
          client.sendMessage(id, formatter.postponeReminderText(lead), {
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
