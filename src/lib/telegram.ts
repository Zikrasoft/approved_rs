import { SERVICE_LABELS } from '@/utils/labels';
import { isTrackedContactChannel, type TrackedContactChannel } from '@/utils/contactChannel';
import { roundMoney, getCommission, type StoredLead, type LeadStatus, type OwedRow } from './store';

const BOT_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = import.meta.env.TELEGRAM_GROUP_ID!;
const OWNER_ID = import.meta.env.TELEGRAM_OWNER_ID;
const ADMIN_ID = import.meta.env.TELEGRAM_ADMIN_ID;
const BOT_USERNAME = import.meta.env.TELEGRAM_BOT_USERNAME;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export type Role = 'owner' | 'admin';

type Btn = { text: string; callback_data?: string; url?: string };
type Keyboard = { inline_keyboard: Btn[][] };

// Telegram/phone tab both submit a plain contact string (handle or number);
// contactChannel says which app the visitor actually wants to be reached on
// — WhatsApp/Viber/phone share the same phone-number input in the form, so
// without this staff would have to guess which app to open.
const CONTACT_CHANNEL_LABELS: Record<TrackedContactChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  phone: 'звонок',
};

// Status labels/emoji for the lead detail view. Status *transitions* are
// state-dependent (see buildStatusKeyboard) rather than "all 3 buttons,
// always" — matches how fast staff can actually act on a card.
export const LEAD_STATUSES = [
  { key: 'in_progress', emoji: '🔵', label: 'В работе' },
  { key: 'won', emoji: '✅', label: 'Успешно' },
  { key: 'lost', emoji: '❌', label: 'Отказ' },
] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number]['key'];

export function isLeadStatusKey(key: string): key is LeadStatusKey {
  return LEAD_STATUSES.some(s => s.key === key);
}

export function statusLabel(status: LeadStatus): string {
  if (status === 'new') return 'Новая';
  return LEAD_STATUSES.find(s => s.key === status)?.label ?? status;
}

function statusEmoji(status: LeadStatus): string {
  if (status === 'new') return '🆕';
  return LEAD_STATUSES.find(s => s.key === status)?.emoji ?? '⚪';
}

// Bold + an emoji so the status actually stands out instead of reading like
// every other line.
function statusLine(status: LeadStatus): string {
  return `<b>Статус: ${statusEmoji(status)} ${statusLabel(status)}</b>`;
}

// Escapes the 3 characters HTML parse_mode treats specially. Required for
// every field that isn't a string literal we wrote ourselves — lead.name/
// contact/comment/etc. come straight from a public form.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
}

// The full card body — deal amount included, commission/paid/owed NOT
// (those are appended separately in buildLeadDetail, since they only make
// sense once a deal exists and their visibility follows the money-track
// rules there, not this generic renderer).
function formatLeadText(lead: StoredLead): string {
  const service = SERVICE_LABELS[lead.service] ?? lead.service;
  const channelLabel = isTrackedContactChannel(lead.contactChannel) ? CONTACT_CHANNEL_LABELS[lead.contactChannel] : undefined;
  const contactLine = channelLabel ? `${lead.contact} (${channelLabel})` : lead.contact;
  const lines: string[] = [
    `🚗 Заявка #${lead.id} — ${escapeHtml(service)}`,
    statusLine(lead.status),
  ];
  if (lead.dealAmount != null) lines.push(`💰 Сумма сделки: ${formatMoney(lead.dealAmount)}`);
  lines.push(``, `Имя: ${escapeHtml(lead.name)}`, `Контакт: ${escapeHtml(contactLine)}`);
  if (lead.country) lines.push(`Страна: ${escapeHtml(lead.country.toUpperCase())}`);
  if (lead.comment) lines.push(`Комментарий: ${escapeHtml(lead.comment)}`);
  if (lead.source_url) lines.push(`Страница: ${escapeHtml(lead.source_url)}`);
  if (lead.visitorId) lines.push(`ID посетителя: ${escapeHtml(lead.visitorId.slice(0, 100))}`);
  lines.push(``, `#заявка`);
  return lines.join('\n');
}

// State-dependent, not "all statuses always" — new → [В работу|Отказ],
// in_progress → [Завершить|Отказ], won/lost → terminal, no buttons. Fewer,
// clearer taps beats a static row where 2 of 3 buttons are always no-ops.
export function buildStatusKeyboard(lead: StoredLead): Keyboard {
  if (lead.status === 'new') {
    return {
      inline_keyboard: [[
        { text: '🔵 В работу', callback_data: `st:${lead.id}:in_progress` },
        { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
      ]],
    };
  }
  if (lead.status === 'in_progress') {
    return {
      inline_keyboard: [[
        { text: '✅ Завершить', callback_data: `st:${lead.id}:won` },
        { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
      ]],
    };
  }
  // Explicit empty keyboard, not just omitting reply_markup — Telegram keeps
  // whatever keyboard was there before unless you send an empty one.
  return { inline_keyboard: [] };
}

// Minimal group feed line — the group is a read-only "we can see it"
// surface now, not an interaction surface, so no PII/contact/comment here,
// just enough to recognize the lead at a glance.
function formatTeaser(lead: StoredLead): string {
  const service = SERVICE_LABELS[lead.service] ?? lead.service;
  return `🚗 Заявка #${lead.id} · ${escapeHtml(lead.name || '—')} · ${escapeHtml(service)} · ${statusEmoji(lead.status)} ${statusLabel(lead.status)}`;
}

// A misconfigured deploy without this env var would otherwise ship every
// teaser/reminder with a silently dead t.me/undefined link — fail loud once
// instead, the same fail-closed treatment OWNER_ID/ADMIN_ID already get via
// their NaN-comparison in telegram-webhook.ts.
function deepLink(id: number): string {
  if (!BOT_USERNAME) throw new Error('[telegram] TELEGRAM_BOT_USERNAME is not set');
  return `https://t.me/${BOT_USERNAME}?start=lead_${id}`;
}

function deepLinkKeyboard(id: number): Keyboard {
  return { inline_keyboard: [[{ text: '📂 Открыть в боте', url: deepLink(id) }]] };
}

async function tgPost(method: string, body: object): Promise<unknown> {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json() as { result: unknown; description?: string };
  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status} ${data.description ?? ''}`.trim());
  }
  return data.result;
}

// The try/catch + "message is not modified" swallow every in-place edit
// needs (group teaser refresh, DM detail-view refresh) — one place instead
// of two copies.
async function safeEditMessage(chatId: number, messageId: number, text: string, keyboard: Keyboard): Promise<void> {
  try {
    await tgPost('editMessageText', { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    // Double-tapping the same button re-sends identical text+keyboard —
    // Telegram rejects that no-op edit with "message is not modified",
    // which isn't a real failure, just a race the caller shouldn't surface.
    if (err instanceof Error && err.message.includes('message is not modified')) return;
    throw err;
  }
}

export async function sendLeadNotification(lead: StoredLead): Promise<{ chatId: number; messageId: number }> {
  const sent = await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text: formatTeaser(lead),
    parse_mode: 'HTML',
    reply_markup: deepLinkKeyboard(lead.id),
  });
  const result = sent as { message_id?: unknown; chat?: { id?: unknown } } | null;
  const messageId = result?.message_id;
  const chatId = result?.chat?.id;
  if (typeof messageId !== 'number' || typeof chatId !== 'number') {
    throw new Error('[telegram] sendMessage response missing message_id/chat.id');
  }

  // Pinning is how staff find new leads in a busy group — best-effort, a pin
  // failure shouldn't sink the notification itself.
  try {
    await tgPost('pinChatMessage', { chat_id: chatId, message_id: messageId, disable_notification: true });
  } catch (err) {
    console.error('[telegram] pinChatMessage failed', { error: err, messageId });
  }

  return { chatId, messageId };
}

// Refreshes the group teaser in place — source of truth is the blob, the
// group message is just its rendered view. Only ever touches the group
// (guarded below); it has nothing to tap anymore, just a status glance.
export async function refreshLeadCard(lead: StoredLead): Promise<void> {
  if (lead.telegramChatId == null || lead.telegramMessageId == null) return;
  // Only the group chat we actually manage leads in — a bot ever added to a
  // second chat couldn't edit messages there via this path.
  if (String(lead.telegramChatId) !== String(GROUP_ID)) return;
  await safeEditMessage(lead.telegramChatId, lead.telegramMessageId, formatTeaser(lead), deepLinkKeyboard(lead.id));
}

// Plain outgoing message — DM menus, search results, notifications. Kept
// separate from sendLeadNotification/refreshLeadCard because those two care
// about pinning and card-editing semantics that nothing else here needs.
export async function sendMessage(chatId: number | string, text: string, extra?: object): Promise<void> {
  await tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}

// Sends a `force_reply` prompt and returns its message_id — the webhook
// correlates the owner/admin's next reply back to this via
// store.findByPendingPrompt/resolvePendingPrompt, the one mechanism reused
// for deal-amount capture, field edits, and the commission claim.
export async function sendForceReplyPrompt(chatId: number, text: string): Promise<number> {
  const sent = await tgPost('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { force_reply: true, selective: true },
  });
  const messageId = (sent as { message_id?: unknown } | null)?.message_id;
  if (typeof messageId !== 'number') throw new Error('[telegram] force-reply prompt missing message_id');
  return messageId;
}

// Reminder for a lead stuck "in_progress" too long — DMs whoever's chatId
// is passed (reminders.ts sends this to both owner and admin), with the
// deep link so tapping it opens the lead directly.
export async function sendReminderMessage(lead: StoredLead, chatId: number): Promise<void> {
  const days = Math.floor((Date.now() - new Date(lead.statusChangedAt).getTime()) / 86_400_000);
  const service = SERVICE_LABELS[lead.service] ?? lead.service;
  const text = [
    `⚠️ Заявка #${lead.id} всё ещё в работе (${days} дн.)`,
    ``,
    `${escapeHtml(lead.name)} — ${escapeHtml(service)}`,
  ].join('\n');
  await tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: deepLinkKeyboard(lead.id) });
}

// Proactive ping the moment a deal closes — informational only, no button:
// the admin doesn't act until the owner claims a payment (see
// sendCommissionClaimToAdmin).
export async function sendDealNotificationToAdmin(lead: StoredLead): Promise<void> {
  if (!ADMIN_ID || lead.dealAmount == null) return;
  const { commission } = getCommission(lead);
  const text = [
    `💰 Новая сделка`,
    ``,
    `#${lead.id} ${escapeHtml(lead.name)}`,
    ``,
    `Сумма сделки: ${formatMoney(lead.dealAmount)}`,
    `Комиссия (${lead.commissionPercent}%): ${formatMoney(commission)}`,
  ].join('\n');
  await sendMessage(ADMIN_ID, text);
}

// Owner claimed they sent the commission — admin gets this with the
// confirm/reject pair; nothing is counted until one of those is tapped.
export async function sendCommissionClaimToAdmin(lead: StoredLead): Promise<void> {
  if (!ADMIN_ID || !lead.pendingCommissionClaim) return;
  const text = `🔔 Отмечена оплата комиссии по заявке #${lead.id}: ${formatMoney(lead.pendingCommissionClaim.amount)}.\n\nПодтвердить?`;
  await sendMessage(ADMIN_ID, text, {
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` },
        { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
      ]],
    },
  });
}

// Tells the owner what happened to their claim.
export async function sendCommissionResultToOwner(lead: StoredLead, confirmed: boolean): Promise<void> {
  if (!OWNER_ID) return;
  const text = confirmed
    ? `✅ Оплата по заявке #${lead.id} подтверждена.`
    : `❌ Оплата по заявке #${lead.id} не подтверждена, свяжитесь с администратором.`;
  await sendMessage(OWNER_ID, text);
}

export function buildOwedSummary(rows: OwedRow[], total: number): string {
  if (rows.length === 0) return '🟢 Всё оплачено, долгов нет.';
  const lines = rows.map(r => `#${r.id} ${escapeHtml(r.name)} — ${formatMoney(r.remaining)}`);
  return ['🔴 Мне должны', ``, ...lines, ``, `Итого: ${formatMoney(total)}`].join('\n');
}

// Capped like buildLeadList/getOwedSummary — one long message risks
// exceeding Telegram's 4096-char limit as deals accrue.
const MAX_DEALS_ROWS = 20;

export function formatDealsList(leads: StoredLead[]): string {
  const deals = leads
    .filter((l): l is StoredLead & { dealAmount: number } => l.status === 'won' && l.dealAmount != null && !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_DEALS_ROWS);
  if (deals.length === 0) return 'Сделок пока нет.';
  return deals
    .map(l => {
      const { commission, isPaidOff } = getCommission(l);
      const paidMark = isPaidOff ? '🟢 Оплачено' : l.paidAmount > 0 ? `🟡 Оплачено ${formatMoney(l.paidAmount)} из ${formatMoney(commission)}` : '🔴 Не оплачено';
      return `#${l.id} ${escapeHtml(l.name)}\n${formatMoney(l.dealAmount)} · комиссия ${formatMoney(commission)}\n${paidMark}`;
    })
    .join('\n\n');
}

export function formatSearchResults(leads: StoredLead[]): string {
  if (leads.length === 0) return 'Ничего не найдено.';
  return leads
    .map(l => {
      const amount = l.dealAmount != null ? ` — ${formatMoney(l.dealAmount)}` : '';
      const archivedMark = l.archived ? '🗄 ' : '';
      return `${archivedMark}${statusEmoji(l.status)} #${l.id} ${escapeHtml(l.name)} — ${escapeHtml(l.contact)}${amount}`;
    })
    .join('\n');
}

// Leads first for both roles — admin additionally gets the portfolio-level
// money views (owner's financial visibility lives inside each lead's own
// detail view instead, since it's per-lead info, not something they manage
// as a list).
export function buildMenu(role: Role): { text: string; reply_markup: Keyboard } {
  const rows: Btn[][] = [
    [{ text: '🆕 Новые', callback_data: 'list:new' }],
    [{ text: '🔵 В работе', callback_data: 'list:in_progress' }],
    [{ text: '✅ Успешные', callback_data: 'list:won' }],
    [{ text: '❌ Отказы', callback_data: 'list:lost' }],
    [{ text: '📊 Статистика', callback_data: 'menu:stats' }],
  ];
  if (role === 'admin') {
    rows.push([{ text: '🔴 Мне должны', callback_data: 'menu:debt' }]);
    rows.push([{ text: '💰 Все сделки', callback_data: 'menu:deals' }]);
  }
  return {
    text: '📋 Заявки\n\nМожно также прислать имя, телефон или #номер заявки для поиска (найдёт и архивные).',
    reply_markup: { inline_keyboard: rows },
  };
}

// Capped at 20, no pagination — a 2-person shop won't sit on 20+ open leads
// in one bucket; add paging if that ever changes.
export function buildLeadList(leads: StoredLead[], status: LeadStatus): { text: string; reply_markup: Keyboard } {
  const rows: Btn[][] = leads
    .filter(l => l.status === status && !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, 20)
    .map(l => [{ text: `#${l.id} ${l.name || '—'} · ${statusEmoji(l.status)}`, callback_data: `open:${l.id}` }]);
  return {
    text: rows.length ? 'Выберите заявку:' : 'Пусто.',
    reply_markup: { inline_keyboard: rows },
  };
}

// All-time totals, no period picker — more than a 2-person tool needs right
// now. Reuses getCommission for every money figure, same as everywhere else.
export function buildStats(leads: StoredLead[]): string {
  const active = leads.filter(l => !l.archived);
  const archivedCount = leads.length - active.length;
  const count = (s: LeadStatus) => active.filter(l => l.status === s).length;
  const wonLeads = active.filter((l): l is StoredLead & { dealAmount: number } => l.status === 'won' && l.dealAmount != null);
  const turnover = roundMoney(wonLeads.reduce((sum, l) => sum + l.dealAmount, 0));
  const commissionTotal = roundMoney(wonLeads.reduce((sum, l) => sum + getCommission(l).commission, 0));
  const paidTotal = roundMoney(wonLeads.reduce((sum, l) => sum + l.paidAmount, 0));
  const remainingTotal = roundMoney(wonLeads.reduce((sum, l) => sum + getCommission(l).remaining, 0));

  return [
    '📊 Статистика',
    '',
    `Всего заявок: ${active.length}${archivedCount ? ` (+${archivedCount} в архиве)` : ''}`,
    `🆕 Новые: ${count('new')}   🔵 В работе: ${count('in_progress')}   ✅ Завершено: ${count('won')}   ❌ Отказ: ${count('lost')}`,
    '',
    `💰 Оборот (сумма сделок): ${formatMoney(turnover)}`,
    `Комиссия начислена: ${formatMoney(commissionTotal)}`,
    `Оплачено: ${formatMoney(paidTotal)}`,
    `🔴 Осталось получить: ${formatMoney(remainingTotal)}`,
  ].join('\n');
}

// The real interactive surface now — replaces the old group card. Text is
// the shared formatLeadText body plus money-track lines once a deal
// exists; buttons depend on (archived, status, role).
export function buildLeadDetail(lead: StoredLead, role: Role): { text: string; reply_markup: Keyboard } {
  if (lead.archived) {
    return {
      text: `${formatLeadText(lead)}\n\n🗄 В архиве`,
      reply_markup: { inline_keyboard: [[{ text: '♻️ Восстановить', callback_data: `unarch:${lead.id}` }]] },
    };
  }

  const lines = [formatLeadText(lead)];
  const hasDeal = lead.status === 'won' && lead.dealAmount != null;
  const commissionInfo = hasDeal ? getCommission(lead) : null;
  if (commissionInfo) {
    const { commission, remaining, isPaidOff } = commissionInfo;
    lines.push('');
    lines.push(`🧾 Оплата клиента: ${lead.customerPaidAt ? '✅ отмечена' : '⏳ не отмечена'}`);
    lines.push(`💰 Комиссия Zikrasoft: ${formatMoney(commission)} · ${isPaidOff ? '🟢 Оплачено' : `Осталось: ${formatMoney(remaining)}`}`);
    if (lead.pendingCommissionClaim) {
      lines.push(`🕓 Ожидает подтверждения: ${formatMoney(lead.pendingCommissionClaim.amount)}`);
    }
  }

  const rows: Btn[][] = [...buildStatusKeyboard(lead).inline_keyboard];
  rows.push([
    { text: '✏️ Имя', callback_data: `edit:${lead.id}:name` },
    { text: '✏️ Контакт', callback_data: `edit:${lead.id}:contact` },
    { text: '✏️ Комментарий', callback_data: `edit:${lead.id}:comment` },
  ]);
  if (commissionInfo) {
    const { isPaidOff } = commissionInfo;
    if (role === 'owner') {
      rows.push([{ text: lead.customerPaidAt ? '↩️ Клиент не оплатил' : '✅ Клиент оплатил', callback_data: `custpaid:${lead.id}` }]);
      if (!isPaidOff && !lead.pendingCommissionClaim) {
        rows.push([{ text: '💸 Отметить оплату комиссии', callback_data: `claimpay:${lead.id}` }]);
      }
    } else if (lead.pendingCommissionClaim) {
      rows.push([
        { text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` },
        { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
      ]);
    }
  }
  rows.push([{ text: '🗑 Архивировать', callback_data: `arch:${lead.id}` }]);

  return { text: lines.join('\n'), reply_markup: { inline_keyboard: rows } };
}

// Edits the DM message a callback fired on — same "blob is truth, message
// is a rendered view" principle as refreshLeadCard, for the detail view.
export async function editLeadDetailMessage(chatId: number, messageId: number, lead: StoredLead, role: Role): Promise<void> {
  const { text, reply_markup } = buildLeadDetail(lead, role);
  await safeEditMessage(chatId, messageId, text, reply_markup);
}

// Telegram requires every callback_query to be acknowledged, or the
// tapped button's loading spinner never clears on the client's phone.
export async function answerCallback(callbackQueryId: string, text?: string): Promise<void> {
  await tgPost('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}
