// Send/edit orchestration for lead-lifecycle events. Builds nothing itself
// — text/keyboards come from format.ts, delivery from client.ts.
import type { StoredLead } from '../store';
import { tgPost, expectMessageAndChatId, safeEditMessage, sendMessage, GROUP_ID, OWNER_ID, ADMIN_ID } from './client';
import {
  formatTeaser, deepLinkKeyboard, reminderText, dealNotificationText, commissionClaimText,
  commissionResultText, buildLeadDetail, type Role,
} from './format';

export async function sendLeadNotification(lead: StoredLead): Promise<{ chatId: number; messageId: number }> {
  const sent = await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text: formatTeaser(lead),
    parse_mode: 'HTML',
    reply_markup: deepLinkKeyboard(lead.id),
  });
  const { messageId, chatId } = expectMessageAndChatId(sent, 'sendMessage');

  // Pinning is best-effort — a pin failure shouldn't sink the notification.
  try {
    await tgPost('pinChatMessage', { chat_id: chatId, message_id: messageId, disable_notification: true });
  } catch (err) {
    console.error('[telegram] pinChatMessage failed', { error: err, messageId });
  }

  return { chatId, messageId };
}

export async function refreshLeadCard(lead: StoredLead): Promise<void> {
  if (lead.telegramChatId == null || lead.telegramMessageId == null) return;
  if (String(lead.telegramChatId) !== String(GROUP_ID)) return;
  await safeEditMessage(lead.telegramChatId, lead.telegramMessageId, formatTeaser(lead), deepLinkKeyboard(lead.id));
}

export async function sendReminderMessage(lead: StoredLead, chatId: number): Promise<void> {
  await tgPost('sendMessage', { chat_id: chatId, text: reminderText(lead), parse_mode: 'HTML', reply_markup: deepLinkKeyboard(lead.id) });
}

export async function sendDealNotificationToAdmin(lead: StoredLead): Promise<void> {
  if (!ADMIN_ID || lead.dealAmount == null) return;
  await sendMessage(ADMIN_ID, dealNotificationText({ ...lead, dealAmount: lead.dealAmount }));
}

export async function sendCommissionClaimToAdmin(lead: StoredLead): Promise<void> {
  if (!ADMIN_ID || !lead.pendingCommissionClaim) return;
  await sendMessage(ADMIN_ID, commissionClaimText({ ...lead, pendingCommissionClaim: lead.pendingCommissionClaim }), {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` },
        { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
      ]],
    },
  });
}

export async function sendCommissionResultToOwner(lead: StoredLead, confirmed: boolean): Promise<void> {
  if (!OWNER_ID) return;
  await sendMessage(OWNER_ID, commissionResultText(lead.id, confirmed));
}

export async function editLeadDetailMessage(chatId: number, messageId: number, lead: StoredLead, role: Role): Promise<void> {
  const { text, reply_markup } = buildLeadDetail(lead, role);
  await safeEditMessage(chatId, messageId, text, reply_markup);
}
