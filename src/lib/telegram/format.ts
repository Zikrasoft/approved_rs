// Pure rendering: lead → text/keyboard. No network calls — notify.ts sends
// what this module builds.
import { format, parseISO } from 'date-fns';
import { SERVICE_LABELS } from '@/utils/labels';
import { isTrackedContactChannel, type TrackedContactChannel } from '@/utils/contactChannel';
import { roundMoney, getCommission, MAX_LIST_ROWS, type StoredLead, type LeadStatus, type OwedRow, type CommissionInfo } from '../store';
import { BOT_USERNAME } from './client';

export type Role = 'owner' | 'admin';

export type Btn = { text: string; callback_data?: string; url?: string };
export type Keyboard = { inline_keyboard: Btn[][] };

// Phone tab shares one number field across WhatsApp/Viber/phone.
const CONTACT_CHANNEL_LABELS: Record<TrackedContactChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  phone: 'звонок',
};

// Status transitions are state-dependent — see buildStatusKeyboard.
export const LEAD_STATUSES = [
  { key: 'in_progress', emoji: '🔵', label: 'В работе' },
  { key: 'won', emoji: '✅', label: 'Успешно' },
  { key: 'lost', emoji: '❌', label: 'Отказ' },
] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number]['key'];

export function isLeadStatusKey(key: string): key is LeadStatusKey {
  return LEAD_STATUSES.some(s => s.key === key);
}

const NEW_STATUS_META = { emoji: '🆕', label: 'Новая' } as const;
// Deliberately not in LEAD_STATUSES — that list drives the generic `st:`
// transition, and postponing must always go through the date prompt
// (postpone:<id>), never a bare status flip.
const POSTPONED_STATUS_META = { emoji: '⏸️', label: 'Отложена' } as const;
const UNKNOWN_STATUS_META = { emoji: '⚪' };

function statusMeta(status: LeadStatus): { emoji: string; label: string } {
  if (status === 'new') return NEW_STATUS_META;
  if (status === 'postponed') return POSTPONED_STATUS_META;
  const found = LEAD_STATUSES.find(s => s.key === status);
  return found ?? { ...UNKNOWN_STATUS_META, label: status };
}

export function statusLabel(status: LeadStatus): string {
  return statusMeta(status).label;
}

function statusEmoji(status: LeadStatus): string {
  return statusMeta(status).emoji;
}

function statusLine(status: LeadStatus): string {
  return `<b>Статус: ${statusEmoji(status)} ${statusLabel(status)}</b>`;
}

// HTML parse_mode special chars — required for any field not written by us.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} €`;
}

// 'YYYY-MM-DD' (how remindAt is stored) -> 'ДД.ММ.ГГГГ' (how it's typed/shown).
export function formatDateRu(iso: string): string {
  return format(parseISO(iso), 'dd.MM.yyyy');
}

const QUICK_REMIND_DAYS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 3 дня', days: 3 },
  { label: 'Через неделю', days: 7 },
  { label: 'Через 2 недели', days: 14 },
  { label: 'Через месяц', days: 30 },
] as const;

// The "⏰ Отложить" tap lands here first — quick presets or type a date,
// instead of forcing a typed date up front.
export function buildRemindPicker(id: number): { text: string; reply_markup: Keyboard } {
  const rows: Btn[][] = QUICK_REMIND_DAYS.map(o => [{ text: o.label, callback_data: `remindpick:${id}:${o.days}` }]);
  rows.push([{ text: '✍️ Своя дата', callback_data: `remindtype:${id}` }]);
  rows.push([{ text: '◀️ Назад', callback_data: `remindcancel:${id}` }]);
  return { text: '⏰ Когда напомнить?', reply_markup: { inline_keyboard: rows } };
}

function serviceLabel(service: string): string {
  return SERVICE_LABELS[service] ?? service;
}

// Full card body — commission/paid lines live in buildLeadDetail instead.
function formatLeadText(lead: StoredLead, role: Role): string {
  const channelLabel = isTrackedContactChannel(lead.contactChannel) ? CONTACT_CHANNEL_LABELS[lead.contactChannel] : undefined;
  const contactLine = channelLabel ? `${lead.contact} (${channelLabel})` : lead.contact;
  const lines: string[] = [
    `🚗 Заявка #${lead.id} — ${escapeHtml(serviceLabel(lead.service))}`,
    statusLine(lead.status),
  ];
  if (lead.dealAmount != null) {
    lines.push(role === 'owner'
      ? `💰 Твой доход с заявки: ${formatMoney(lead.dealAmount)}`
      : `💰 Доход владельца с заявки: ${formatMoney(lead.dealAmount)}`);
  }
  if (lead.status === 'postponed' && lead.remindAt) lines.push(`⏰ Напомнить: ${formatDateRu(lead.remindAt)}`);
  lines.push(``, `Имя: ${escapeHtml(lead.name)}`, `Контакт: ${escapeHtml(contactLine)}`);
  if (lead.country) lines.push(`Страна: ${escapeHtml(lead.country.toUpperCase())}`);
  if (lead.comment) lines.push(`Комментарий: ${escapeHtml(lead.comment)}`);
  if (lead.source_url) lines.push(`Страница: ${escapeHtml(lead.source_url)}`);
  if (lead.visitorId) lines.push(`ID посетителя: ${escapeHtml(lead.visitorId.slice(0, 100))}`);
  lines.push(``, `#заявка`);
  return lines.join('\n');
}

// Finalizing a lead (won/lost) is owner-only — only the owner knows the deal
// amount and talks to the client directly, so admin gets no buttons past "В работу".
export function buildStatusKeyboard(lead: StoredLead, role: Role): Keyboard {
  if (lead.status === 'new') {
    const row: Btn[] = [{ text: '🔵 В работу', callback_data: `st:${lead.id}:in_progress` }];
    if (role === 'owner') row.push({ text: '❌ Отказ', callback_data: `st:${lead.id}:lost` });
    return { inline_keyboard: [row] };
  }
  if (lead.status === 'in_progress' && role === 'owner') {
    return {
      inline_keyboard: [
        [
          { text: '✅ Завершить', callback_data: `st:${lead.id}:won` },
          { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
        ],
        [{ text: '⏰ Отложить', callback_data: `postpone:${lead.id}` }],
      ],
    };
  }
  if (lead.status === 'postponed') {
    return { inline_keyboard: [[{ text: '▶️ Возобновить', callback_data: `resume:${lead.id}` }]] };
  }
  // Explicit empty array — omitted reply_markup would keep the old keyboard.
  return { inline_keyboard: [] };
}

// Group is read-only now — no PII, just enough to recognize the lead.
export function formatTeaser(lead: StoredLead): string {
  return `🚗 Заявка #${lead.id} · ${escapeHtml(lead.name || '—')} · ${escapeHtml(serviceLabel(lead.service))} · ${statusEmoji(lead.status)} ${statusLabel(lead.status)}`;
}

function deepLink(id: number): string {
  return `https://t.me/${BOT_USERNAME}?start=lead_${id}`;
}

export function deepLinkKeyboard(id: number): Keyboard {
  return { inline_keyboard: [[{ text: '📂 Открыть в боте', url: deepLink(id) }]] };
}

export function postponeReminderText(lead: StoredLead): string {
  return [
    `⏰ Напоминание по заявке #${lead.id}`,
    ``,
    `${escapeHtml(lead.name)} — ${escapeHtml(serviceLabel(lead.service))}`,
    `Ты просил напомнить сегодня — заявка снова в работе.`,
  ].join('\n');
}

export function dealNotificationText(lead: StoredLead & { dealAmount: number }): string {
  const { commission } = getCommission(lead);
  return [
    `💰 Новая сделка`,
    ``,
    `#${lead.id} ${escapeHtml(lead.name)}`,
    ``,
    `Доход с заявки: ${formatMoney(lead.dealAmount)}`,
    `Твоя комиссия (${lead.commissionPercent}%): ${formatMoney(commission)}`,
  ].join('\n');
}

export function commissionClaimText(lead: StoredLead & { pendingCommissionClaim: NonNullable<StoredLead['pendingCommissionClaim']> }): string {
  return `🔔 Отмечена оплата комиссии по заявке #${lead.id}: ${formatMoney(lead.pendingCommissionClaim.amount)}.\n\nПодтвердить?`;
}

export function commissionResultText(leadId: number, confirmed: boolean): string {
  return confirmed
    ? `✅ Оплата по заявке #${leadId} подтверждена.`
    : `❌ Оплата по заявке #${leadId} не подтверждена, свяжитесь с администратором.`;
}

// 'won' isn't covered here — that transition gets its own richer notification
// (dealNotificationText, sent once the deal amount is in).
export function statusChangeText(lead: StoredLead): string {
  const meta = statusMeta(lead.status);
  return `🔔 Заявка #${lead.id} ${escapeHtml(lead.name)}: статус — ${meta.emoji} ${meta.label}`;
}

// Tappable, not a text block — shared by both owner and admin (whoever
// still owes/is owed commission on a lead), each row opens that lead
// directly. Neutral header ("Долг по комиссии") on purpose: "Мне должны"
// only reads correctly from the admin's side, "Ты должен" only from the
// owner's — one wording that works for both instead of a role branch.
export function buildOwedList(rows: OwedRow[], total: number): { text: string; reply_markup: Keyboard } {
  if (rows.length === 0) {
    return { text: '<b>🔴 Долг по комиссии</b>\n\n🟢 Всё оплачено, долгов нет.', reply_markup: { inline_keyboard: [] } };
  }
  const buttons: Btn[][] = rows.map(r => [{ text: `#${r.id} ${r.name} — ${formatMoney(r.remaining)}`, callback_data: `open:${r.id}` }]);
  return {
    text: `<b>🔴 Долг по комиссии</b>\n\nИтого: ${formatMoney(total)}`,
    reply_markup: { inline_keyboard: buttons },
  };
}

function paidStatusMark(l: StoredLead & { dealAmount: number }, info: CommissionInfo): string {
  if (info.isPaidOff) return '🟢 Оплачено';
  if (l.paidAmount > 0) return `🟡 Оплачено ${formatMoney(l.paidAmount)} из ${formatMoney(info.commission)}`;
  return '🔴 Не оплачено';
}

export function formatDealsList(leads: StoredLead[]): string {
  const deals = leads
    .filter((l): l is StoredLead & { dealAmount: number } => l.status === 'won' && l.dealAmount != null && !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS);
  if (deals.length === 0) return '<b>💰 Все сделки</b>\n\nСделок пока нет.';
  const lines = deals.map(l => {
    const info = getCommission(l);
    return `#${l.id} ${escapeHtml(l.name)}\nдоход ${formatMoney(l.dealAmount)} · комиссия ${formatMoney(info.commission)}\n${paidStatusMark(l, info)}`;
  });
  return ['<b>💰 Все сделки</b>', ...lines].join('\n\n');
}

export function buildSearchResults(leads: StoredLead[]): { text: string; reply_markup: Keyboard } {
  if (leads.length === 0) return { text: 'Ничего не найдено.', reply_markup: { inline_keyboard: [] } };
  const rows: Btn[][] = leads.slice(0, MAX_LIST_ROWS).map(l => {
    const amount = l.dealAmount != null ? ` — ${formatMoney(l.dealAmount)}` : '';
    const archivedMark = l.archived ? '🗄 ' : '';
    const label = `${archivedMark}${statusEmoji(l.status)} #${l.id} ${l.name} — ${l.contact}${amount}`;
    return [{ text: label, callback_data: `open:${l.id}` }];
  });
  return { text: 'Найдено:', reply_markup: { inline_keyboard: rows } };
}

// Owner's money view lives inside each lead's detail, not a menu item.
export function buildMenu(role: Role): { text: string; reply_markup: Keyboard } {
  const rows: Btn[][] = [
    [{ text: '🆕 Новые', callback_data: 'list:new' }],
    [{ text: '🔵 В работе', callback_data: 'list:in_progress' }],
    [{ text: '✅ Успешные', callback_data: 'list:won' }],
    [{ text: '❌ Отказы', callback_data: 'list:lost' }],
    [{ text: '⏸ Отложенные', callback_data: 'list:postponed' }],
    [{ text: '📊 Статистика', callback_data: 'menu:stats' }],
  ];
  rows.push([{ text: role === 'owner' ? '🔴 Мой долг по комиссии' : '🔴 Мне должны', callback_data: 'menu:debt' }]);
  if (role === 'admin') {
    rows.push([{ text: '💰 Все сделки', callback_data: 'menu:deals' }]);
  }
  return {
    text: '📋 Заявки\n\nМожно также прислать имя, телефон или #номер заявки для поиска (найдёт и архивные).',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildHelp(role: Role): string {
  if (role === 'owner') {
    return [
      '<b>❓ Как пользоваться</b>',
      '',
      '<b>Заявки</b>',
      '🆕 Новая → 🔵 В работу → ✅ Завершить (укажи свою прибыль в €) или ❌ Отказ.',
      'Не договорились сейчас? ⏰ Отложить — укажи дату (ДД.ММ.ГГГГ), заявка вернётся в работу сама в этот день, или жми ▶️ Возобновить раньше.',
      'В заявке можно поправить имя/контакт/комментарий или архивировать.',
      '',
      '<b>Комиссия (10% от прибыли)</b>',
      'На завершённой заявке — 💸 Отметить оплату комиссии. Считается, что отправил остаток целиком, сумму вводить не надо. Админ подтвердит или отклонит.',
      '',
      '<b>Меню</b>',
      'Списки заявок, 📊 Статистика, 🔴 Мой долг по комиссии. Найти заявку — просто пришли имя, телефон или номер.',
    ].join('\n');
  }
  return [
    '<b>❓ Как пользоваться</b>',
    '',
    'Заявки можно двигать в работу, но завершает или отказывает только владелец — у тебя таких кнопок нет.',
    '',
    '<b>Комиссия</b>',
    'Когда владелец отмечает оплату — тебе приходит уведомление, жми ✅ Подтвердить или ❌ Отклонить.',
    '',
    '<b>Меню</b>',
    '📊 Статистика, 🔴 Мне должны (кто ещё не оплатил), 💰 Все сделки — полный список с суммами. Найти заявку — просто пришли имя, телефон или номер.',
    '',
    '<b>Удаление</b>',
    '❌ Удалить навсегда — только у тебя, владелец такого не видит. Спросит подтверждение и стирает заявку без возврата (в отличие от 🗑 Архивировать).',
  ].join('\n');
}

export function buildLeadList(leads: StoredLead[], status: LeadStatus): { text: string; reply_markup: Keyboard } {
  const rows: Btn[][] = leads
    .filter(l => l.status === status && !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS)
    .map(l => [{ text: `#${l.id} ${l.name || '—'} · ${statusEmoji(l.status)}`, callback_data: `open:${l.id}` }]);
  return {
    text: rows.length ? 'Выберите заявку:' : 'Пусто.',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildStats(leads: StoredLead[], role: Role): string {
  const active = leads.filter(l => !l.archived);
  const archivedCount = leads.length - active.length;
  const count = (s: LeadStatus) => active.filter(l => l.status === s).length;
  const wonLeads = active.filter((l): l is StoredLead & { dealAmount: number } => l.status === 'won' && l.dealAmount != null);
  const totalEarned = roundMoney(wonLeads.reduce((sum, l) => sum + l.dealAmount, 0));
  const commissionTotal = roundMoney(wonLeads.reduce((sum, l) => sum + getCommission(l).commission, 0));
  const paidTotal = roundMoney(wonLeads.reduce((sum, l) => sum + l.paidAmount, 0));
  const remainingTotal = roundMoney(wonLeads.reduce((sum, l) => sum + getCommission(l).remaining, 0));

  const moneyLines = role === 'owner'
    ? [
        `💰 Заработано: ${formatMoney(totalEarned)}`,
        `Комиссия к оплате: ${formatMoney(commissionTotal)}`,
        `Оплачено: ${formatMoney(paidTotal)}`,
        `🔴 Осталось оплатить: ${formatMoney(remainingTotal)}`,
      ]
    : [
        `💰 Заработано (доход владельца): ${formatMoney(totalEarned)}`,
        `Комиссия начислена: ${formatMoney(commissionTotal)}`,
        `Оплачено: ${formatMoney(paidTotal)}`,
        `🔴 Осталось получить: ${formatMoney(remainingTotal)}`,
      ];

  return [
    '<b>📊 Статистика</b>',
    '',
    `Всего заявок: ${active.length}${archivedCount ? ` (+${archivedCount} в архиве)` : ''}`,
    `🆕 Новые: ${count('new')}   🔵 В работе: ${count('in_progress')}   ✅ Завершено: ${count('won')}   ❌ Отказ: ${count('lost')}   ⏸ Отложено: ${count('postponed')}`,
    '',
    ...moneyLines,
  ].join('\n');
}

function moneyStatusLines(lead: StoredLead, info: CommissionInfo): string[] {
  const lines = [
    '',
    `💰 Комиссия Zikrasoft: ${formatMoney(info.commission)} · ${info.isPaidOff ? '🟢 Оплачено' : `Осталось: ${formatMoney(info.remaining)}`}`,
  ];
  if (lead.pendingCommissionClaim) lines.push(`🕓 Ожидает подтверждения: ${formatMoney(lead.pendingCommissionClaim.amount)}`);
  return lines;
}

function moneyActionRows(lead: StoredLead, role: Role, info: CommissionInfo): Btn[][] {
  if (role === 'owner') {
    if (!info.isPaidOff && !lead.pendingCommissionClaim) {
      return [[{ text: '💸 Отметить оплату комиссии', callback_data: `claimpay:${lead.id}` }]];
    }
    return [];
  }
  return lead.pendingCommissionClaim
    ? [[{ text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` }, { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` }]]
    : [];
}

// Admin only — owner gets archive, never permanent delete.
export function buildDeleteConfirm(lead: StoredLead): { text: string; reply_markup: Keyboard } {
  return {
    text: `❗ Удалить заявку #${lead.id} (${escapeHtml(lead.name)}) навсегда? Это нельзя отменить.`,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Да, удалить', callback_data: `delconfirm:${lead.id}` },
        { text: '↩️ Отмена', callback_data: `delcancel:${lead.id}` },
      ]],
    },
  };
}

export function buildLeadDetail(lead: StoredLead, role: Role): { text: string; reply_markup: Keyboard } {
  const deleteRow: Btn[][] = role === 'admin' ? [[{ text: '❌ Удалить навсегда', callback_data: `del:${lead.id}` }]] : [];

  if (lead.archived) {
    return {
      text: `${formatLeadText(lead, role)}\n\n🗄 В архиве`,
      reply_markup: { inline_keyboard: [[{ text: '♻️ Восстановить', callback_data: `unarch:${lead.id}` }], ...deleteRow] },
    };
  }

  const commission = lead.status === 'won' && lead.dealAmount != null ? getCommission(lead) : null;
  const lines = [formatLeadText(lead, role), ...(commission ? moneyStatusLines(lead, commission) : [])];
  const rows: Btn[][] = [
    ...buildStatusKeyboard(lead, role).inline_keyboard,
    [
      { text: '✏️ Имя', callback_data: `edit:${lead.id}:name` },
      { text: '✏️ Контакт', callback_data: `edit:${lead.id}:contact` },
      { text: '✏️ Комментарий', callback_data: `edit:${lead.id}:comment` },
    ],
    ...(commission ? moneyActionRows(lead, role, commission) : []),
    [{ text: '🗑 Архивировать', callback_data: `arch:${lead.id}` }],
    ...deleteRow,
  ];

  return { text: lines.join('\n'), reply_markup: { inline_keyboard: rows } };
}
