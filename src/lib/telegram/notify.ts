// Send/edit orchestration for lead-lifecycle events. Builds nothing itself
// — text/keyboards come from format.ts, delivery from client.ts.
import type { StoredLead } from '../store';
import {
  tgPost,
  expectMessageAndChatId,
  safeEditMessage,
  sendMessage,
  GROUP_ID,
  OWNER_IDS,
  ADMIN_IDS,
} from './client';
import {
  formatTeaser,
  deepLinkKeyboard,
  postponeReminderText,
  dealNotificationText,
  commissionClaimText,
  commissionResultText,
  statusChangeText,
  buildLeadDetail,
  type Role,
} from './format';

export async function sendLeadNotification(
  lead: StoredLead,
): Promise<{ chatId: number; messageId: number }> {
  const sent = await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text: formatTeaser(lead),
    parse_mode: 'HTML',
    reply_markup: deepLinkKeyboard(lead.id),
  });
  const { messageId, chatId } = expectMessageAndChatId(sent, 'sendMessage');

  // Pinning is best-effort — a pin failure shouldn't sink the notification.
  try {
    await tgPost('pinChatMessage', {
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
}

export async function refreshLeadCard(lead: StoredLead): Promise<void> {
  if (lead.telegramChatId == null || lead.telegramMessageId == null) return;
  if (String(lead.telegramChatId) !== String(GROUP_ID)) return;
  await safeEditMessage(
    lead.telegramChatId,
    lead.telegramMessageId,
    formatTeaser(lead),
    deepLinkKeyboard(lead.id),
  );
}

// One person, possibly several Telegram accounts — every id gets the message.
async function sendToAll(
  ids: number[],
  text: string,
  extra?: object,
): Promise<void> {
  await Promise.all(ids.map((id) => sendMessage(id, text, extra)));
}

export async function sendDealNotificationToAdmin(
  lead: StoredLead,
): Promise<void> {
  if (lead.dealAmount == null) return;
  await sendToAll(
    ADMIN_IDS,
    dealNotificationText({ ...lead, dealAmount: lead.dealAmount }),
  );
}

export async function sendCommissionClaimToAdmin(
  lead: StoredLead,
): Promise<void> {
  if (!lead.pendingCommissionClaim) return;
  await sendToAll(
    ADMIN_IDS,
    commissionClaimText({
      ...lead,
      pendingCommissionClaim: lead.pendingCommissionClaim,
    }),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` },
            { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
          ],
        ],
      },
    },
  );
}

export async function sendCommissionResultToOwner(
  lead: StoredLead,
  confirmed: boolean,
): Promise<void> {
  await sendToAll(OWNER_IDS, commissionResultText(lead.id, confirmed));
}

export async function sendStatusChangeToAdmin(lead: StoredLead): Promise<void> {
  await sendToAll(ADMIN_IDS, statusChangeText(lead));
}

// The owner set the date ("Напомни мне X") — this is their own reminder, not
// a general status ping, so only they get it (unlike sendStatusChangeToAdmin).
// allSettled, not all — the owner can have several Telegram accounts, and
// one account's send failing (e.g. they blocked the bot there) shouldn't
// re-send to every OTHER account too on the next cron tick. Only reject
// (so the caller keeps the lead 'due' and retries) if every send failed.
export async function sendPostponeReminderToOwner(
  lead: StoredLead,
): Promise<void> {
  const results = await Promise.allSettled(
    OWNER_IDS.map((id) =>
      tgPost('sendMessage', {
        chat_id: id,
        text: postponeReminderText(lead),
        parse_mode: 'HTML',
        reply_markup: deepLinkKeyboard(lead.id),
      }),
    ),
  );
  if (results.length > 0 && results.every((r) => r.status === 'rejected')) {
    throw (results[0] as PromiseRejectedResult).reason;
  }
}

export async function editLeadDetailMessage(
  chatId: number,
  messageId: number,
  lead: StoredLead,
  role: Role,
): Promise<void> {
  const { text, reply_markup } = buildLeadDetail(lead, role);
  await safeEditMessage(chatId, messageId, text, reply_markup);
}
