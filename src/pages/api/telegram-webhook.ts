export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import {
  isLeadStatusKey, answerCallback, refreshLeadCard, sendForceReplyPrompt, safeEditMessage,
  sendDealNotificationToAdmin, sendCommissionClaimToAdmin, sendCommissionResultToOwner, sendMessage,
  buildOwedList, formatDealsList, buildSearchResults, buildMenu, buildHelp, buildLeadList, buildStats,
  buildLeadDetail, buildDeleteConfirm, editLeadDetailMessage, type Role,
} from '@/lib/telegram';
import {
  getLead, setStatus, archiveLead, unarchiveLead, deleteLead, confirmCommissionPayment, claimFullCommission,
  rejectCommissionPayment, setPendingPrompt, findByPendingPrompt, resolvePendingPrompt, searchLeads,
  getOwedSummary, readLeads, getCommission, type LeadStatus, type StoredLead,
} from '@/lib/store';

const WEBHOOK_SECRET = import.meta.env.TELEGRAM_WEBHOOK_SECRET;
const OWNER_ID = Number(import.meta.env.TELEGRAM_OWNER_ID);
const ADMIN_ID = Number(import.meta.env.TELEGRAM_ADMIN_ID);

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number; type: string };
  from?: { id: number };
  reply_to_message?: { message_id: number };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    message?: TelegramMessage;
  };
}

const ACK = new Response(null, { status: 200 });

function roleOf(id: number | undefined): Role | undefined {
  if (id === OWNER_ID) return 'owner';
  if (id === ADMIN_ID) return 'admin';
  return undefined;
}

// Strips everything but digits/decimal, rejects a leading '-' explicitly
// (rather than letting it get silently stripped into a positive number),
// requires strictly positive.
function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.startsWith('-')) return null;
  const amount = Number(trimmed.replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// Every mutation touches two surfaces — the group teaser and whichever DM
// message the callback fired on — from one fresh StoredLead.
async function refreshBothSurfaces(updated: StoredLead | undefined, chatId: number, messageId: number, role: Role): Promise<void> {
  if (!updated) return;
  await refreshLeadCard(updated);
  await editLeadDetailMessage(chatId, messageId, updated, role);
}

// Every mutating callback needs the same shape: try the action, and if it
// throws, still ack with an error so the tapped button stops spinning
// instead of hanging forever (the outer POST catch only logs, it never
// acks). One place instead of duplicating try/catch per handler.
async function withErrorAck(cbId: string, logCtx: Record<string, unknown>, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (err) {
    console.error('[telegram-webhook] callback handler failed', { error: err, ...logCtx });
    await answerCallback(cbId, 'Ошибка, попробуйте ещё раз').catch(() => {});
  }
}

// Shared role gate for the handful of owner-only/admin-only callbacks —
// acks-and-rejects on mismatch, same as every other "not allowed" path.
async function requireRole(role: Role, needed: Role, cbId: string): Promise<boolean> {
  if (role === needed) return true;
  await answerCallback(cbId).catch(() => {});
  return false;
}

async function handleStatusCallback(id: number, key: string, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  if (!isLeadStatusKey(key)) {
    await answerCallback(cbId).catch(() => {});
    return;
  }
  if ((key === 'won' || key === 'lost') && !(await requireRole(role, 'owner', cbId))) return;
  await withErrorAck(cbId, { id, key }, async () => {
    const lead = await getLead(id);
    if (!lead) {
      await answerCallback(cbId).catch(() => {});
      return;
    }
    if (key === 'won' && lead.dealAmount == null) {
      const promptId = await sendForceReplyPrompt(chatId, '💰 Сколько ты заработал с этой заявки (в евро)? Не стоимость машины, а твоя прибыль.\n\nНапример: 300');
      await setPendingPrompt(id, { chatId, messageId: promptId, kind: 'deal_amount' });
      await answerCallback(cbId, 'Жду сумму');
      return;
    }
    const updated = await setStatus(id, key);
    await refreshBothSurfaces(updated, chatId, messageId, role);
    await answerCallback(cbId, 'Статус обновлён');
  });
}

async function handleArchiveCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const updated = await archiveLead(id);
    await refreshBothSurfaces(updated, chatId, messageId, role);
    await answerCallback(cbId, 'Архивировано');
  });
}

async function handleUnarchiveCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const updated = await unarchiveLead(id);
    await refreshBothSurfaces(updated, chatId, messageId, role);
    await answerCallback(cbId, 'Восстановлено');
  });
}

async function handleDeleteCallback(id: number, chatId: number, messageId: number, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const lead = await getLead(id);
    if (!lead) {
      await answerCallback(cbId).catch(() => {});
      return;
    }
    const { text, reply_markup } = buildDeleteConfirm(lead);
    await safeEditMessage(chatId, messageId, text, reply_markup);
    await answerCallback(cbId);
  });
}

async function handleDeleteConfirmCallback(id: number, chatId: number, messageId: number, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    await deleteLead(id);
    await safeEditMessage(chatId, messageId, '🗑 Заявка удалена.', { inline_keyboard: [] });
    await answerCallback(cbId, 'Удалено');
  });
}

async function handleDeleteCancelCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const lead = await getLead(id);
    if (lead) {
      await editLeadDetailMessage(chatId, messageId, lead, role);
    } else {
      await safeEditMessage(chatId, messageId, 'Заявка не найдена.', { inline_keyboard: [] });
    }
    await answerCallback(cbId);
  });
}

async function handleClaimPayCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const lead = await getLead(id);
    if (!lead || lead.dealAmount == null) {
      await answerCallback(cbId).catch(() => {});
      return;
    }
    const { isPaidOff } = getCommission(lead);
    if (isPaidOff || lead.pendingCommissionClaim) {
      await answerCallback(cbId).catch(() => {});
      return;
    }
    const updated = await claimFullCommission(id);
    if (updated) {
      await refreshBothSurfaces(updated, chatId, messageId, role);
      await sendCommissionClaimToAdmin(updated);
    }
    await answerCallback(cbId, 'Отмечено — ждём подтверждения');
  });
}

async function handleConfirmPayCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const updated = await confirmCommissionPayment(id);
    await refreshBothSurfaces(updated, chatId, messageId, role);
    if (updated) await sendCommissionResultToOwner(updated, true);
    await answerCallback(cbId);
  });
}

async function handleRejectPayCallback(id: number, chatId: number, messageId: number, role: Role, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id }, async () => {
    const updated = await rejectCommissionPayment(id);
    await refreshBothSurfaces(updated, chatId, messageId, role);
    if (updated) await sendCommissionResultToOwner(updated, false);
    await answerCallback(cbId);
  });
}

const EDIT_FIELD_LABELS = { name: 'имя', contact: 'контакт', comment: 'комментарий' } as const;
type EditField = keyof typeof EDIT_FIELD_LABELS;

async function handleEditCallback(id: number, field: EditField, chatId: number, cbId: string): Promise<void> {
  await withErrorAck(cbId, { id, field }, async () => {
    const lead = await getLead(id);
    if (!lead) {
      await answerCallback(cbId).catch(() => {});
      return;
    }
    const promptId = await sendForceReplyPrompt(chatId, `✏️ Введите новое значение (${EDIT_FIELD_LABELS[field]}):`);
    await setPendingPrompt(id, { chatId, messageId: promptId, kind: `edit_${field}` });
    await answerCallback(cbId, 'Жду значение');
  });
}

async function handleCallbackQuery(cb: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
  const data = cb.data ?? '';
  const message = cb.message;
  if (!message) {
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const role = roleOf(cb.from?.id);
  if (!role) {
    await answerCallback(cb.id).catch(() => {});
    return;
  }

  const statusMatch = /^st:(\d+):(.+)$/.exec(data);
  const archMatch = /^arch:(\d+)$/.exec(data);
  const unarchMatch = /^unarch:(\d+)$/.exec(data);
  const delMatch = /^del:(\d+)$/.exec(data);
  const delConfirmMatch = /^delconfirm:(\d+)$/.exec(data);
  const delCancelMatch = /^delcancel:(\d+)$/.exec(data);
  const claimPayMatch = /^claimpay:(\d+)$/.exec(data);
  const confirmPayMatch = /^confirmpay:(\d+)$/.exec(data);
  const rejectPayMatch = /^rejectpay:(\d+)$/.exec(data);
  const editMatch = /^edit:(\d+):(name|contact|comment)$/.exec(data);
  const listMatch = /^list:(new|in_progress|won|lost)$/.exec(data);
  const openMatch = /^open:(\d+)$/.exec(data);

  if (statusMatch) {
    await handleStatusCallback(Number(statusMatch[1]), statusMatch[2], chatId, messageId, role, cb.id);
    return;
  }
  if (archMatch) {
    await handleArchiveCallback(Number(archMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (unarchMatch) {
    await handleUnarchiveCallback(Number(unarchMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (delMatch) {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await handleDeleteCallback(Number(delMatch[1]), chatId, messageId, cb.id);
    return;
  }
  if (delConfirmMatch) {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await handleDeleteConfirmCallback(Number(delConfirmMatch[1]), chatId, messageId, cb.id);
    return;
  }
  if (delCancelMatch) {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await handleDeleteCancelCallback(Number(delCancelMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (claimPayMatch) {
    if (!(await requireRole(role, 'owner', cb.id))) return;
    await handleClaimPayCallback(Number(claimPayMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (confirmPayMatch) {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await handleConfirmPayCallback(Number(confirmPayMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (rejectPayMatch) {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await handleRejectPayCallback(Number(rejectPayMatch[1]), chatId, messageId, role, cb.id);
    return;
  }
  if (editMatch) {
    await handleEditCallback(Number(editMatch[1]), editMatch[2] as EditField, chatId, cb.id);
    return;
  }
  if (listMatch) {
    const leads = await readLeads();
    const { text, reply_markup } = buildLeadList(leads, listMatch[1] as LeadStatus);
    await sendMessage(chatId, text, { reply_markup });
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  if (openMatch) {
    const lead = await getLead(Number(openMatch[1]));
    if (lead) {
      const { text, reply_markup } = buildLeadDetail(lead, role);
      await sendMessage(chatId, text, { reply_markup });
    }
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  if (data === 'menu:stats') {
    await sendMessage(chatId, buildStats(await readLeads(), role));
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  if (data === 'menu:debt') {
    // Both roles see this — whoever's asking, it's the same "who still
    // owes/is owed commission" list, just framed differently in the text.
    const { rows, total } = await getOwedSummary();
    const { text, reply_markup } = buildOwedList(rows, total);
    await sendMessage(chatId, text, { reply_markup });
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  if (data === 'menu:deals') {
    if (!(await requireRole(role, 'admin', cb.id))) return;
    await sendMessage(chatId, formatDealsList(await readLeads()));
    await answerCallback(cb.id).catch(() => {});
    return;
  }
  // Unrecognized/invalid callback — still ack so the button stops spinning.
  await answerCallback(cb.id).catch(() => {});
}

// A reply to one of our own force_reply prompts — deal amount, a field
// edit, or a commission claim. This is the only free text the bot ever
// acts on outside of /start and DM search, which is what keeps it safe to
// ignore ordinary chatter (see the no-match fallthrough below).
async function handlePromptReply(chatId: number, replyToMessageId: number, text: string): Promise<void> {
  const pending = await findByPendingPrompt(chatId, replyToMessageId);
  if (!pending?.pendingPrompt) return;
  const kind = pending.pendingPrompt.kind;

  if (kind === 'deal_amount') {
    const amount = parseAmount(text);
    if (amount == null) {
      await sendMessage(chatId, '⚠️ Нужно число больше нуля. Попробуйте ещё раз.');
      return;
    }
    const updated = await resolvePendingPrompt(chatId, replyToMessageId, () => ({
      dealAmount: amount,
      status: 'won',
      statusChangedAt: new Date().toISOString(),
      lastRemindedAt: null,
    }));
    if (updated) {
      await refreshLeadCard(updated);
      await sendDealNotificationToAdmin(updated);
    }
    return;
  }

  // edit_name / edit_contact / edit_comment
  const field = kind.slice('edit_'.length) as EditField;
  const value = text.trim();
  if ((field === 'name' || field === 'contact') && !value) {
    await sendMessage(chatId, '⚠️ Значение не может быть пустым. Попробуйте ещё раз.');
    return;
  }
  const updated = await resolvePendingPrompt(chatId, replyToMessageId, () => ({ [field]: value || null }) as Partial<StoredLead>);
  if (updated) {
    await refreshLeadCard(updated);
    await sendMessage(chatId, '✅ Обновлено');
  }
}

async function sendMenuMessage(chatId: number, role: Role): Promise<void> {
  const menu = buildMenu(role);
  await sendMessage(chatId, menu.text, { reply_markup: menu.reply_markup });
}

async function handlePrivateMessage(msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const role = roleOf(msg.from?.id);
  const text = (msg.text ?? '').trim();

  const startMatch = /^\/start(?:\s+(\S+))?$/.exec(text);
  if (startMatch || text === '/menu') {
    if (!role) {
      await sendMessage(chatId, '⛔ Доступ запрещён.');
      return;
    }
    const payload = startMatch?.[1];
    const leadMatch = payload ? /^lead_(\d+)$/.exec(payload) : null;
    if (leadMatch) {
      const lead = await getLead(Number(leadMatch[1]));
      if (lead) {
        const { text: detailText, reply_markup } = buildLeadDetail(lead, role);
        await sendMessage(chatId, detailText, { reply_markup });
        return;
      }
    }
    await sendMenuMessage(chatId, role);
    return;
  }

  if (!role) {
    await sendMessage(chatId, '⛔ Доступ запрещён.');
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId, buildHelp(role));
    return;
  }

  // Plain DM text, not /start, not a prompt reply (that's handled earlier
  // in POST, before chat-type is even checked) — there's nothing else it
  // could mean, so treat it as a search query.
  const results = await searchLeads(text);
  const { text: resultsText, reply_markup } = buildSearchResults(results);
  await sendMessage(chatId, resultsText, { reply_markup });
}

export async function POST({ request }: APIContext): Promise<Response> {
  // Telegram echoes this header back on every webhook call once the webhook
  // is registered with a secret_token (see docs/deploy.md) — the only way
  // to confirm a request actually came from Telegram and not a public POST
  // to a guessable URL. Fail closed if it's missing or wrong.
  if (!secretMatches(request.headers.get('x-telegram-bot-api-secret-token'), WEBHOOK_SECRET)) {
    return new Response(null, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    // Malformed body after a valid secret — ack with 200 so Telegram stops
    // retrying instead of hammering this endpoint forever on a bad payload.
    return ACK;
  }

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message?.reply_to_message) {
      // Checked before chat.type, not gated behind it — a prompt is only
      // ever sent to a DM chatId now, so a reply typed in the group
      // correlates to nothing and safely no-ops below, rather than this
      // class of bug being able to recur if some future path slips.
      await handlePromptReply(update.message.chat.id, update.message.reply_to_message.message_id, update.message.text ?? '');
    } else if (update.message && update.message.chat.type === 'private') {
      await handlePrivateMessage(update.message);
    }
    // Group messages that aren't button presses (chatter) fall through here
    // untouched.
  } catch (err) {
    console.error('[telegram-webhook] unhandled error processing update', { error: err });
  }

  // Telegram retries the webhook on anything but 2xx — always ack even for
  // update types we don't act on.
  return ACK;
}
