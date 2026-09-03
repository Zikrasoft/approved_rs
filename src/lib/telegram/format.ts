// Pure rendering: lead → text/keyboard. No network calls — notify.ts sends
// what this module builds.
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
const UNKNOWN_STATUS_META = { emoji: '⚪' };

function statusMeta(status: LeadStatus): { emoji: string; label: string } {
  if (status === 'new') return NEW_STATUS_META;
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

function serviceLabel(service: string): string {
  return SERVICE_LABELS[service] ?? service;
}

// Full card body — commission/paid lines live in buildLeadDetail instead.
function formatLeadText(lead: StoredLead): string {
  const channelLabel = isTrackedContactChannel(lead.contactChannel) ? CONTACT_CHANNEL_LABELS[lead.contactChannel] : undefined;
  const contactLine = channelLabel ? `${lead.contact} (${channelLabel})` : lead.contact;
  const lines: string[] = [
    `🚗 Заявка #${lead.id} — ${escapeHtml(serviceLabel(lead.service))}`,
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

export function reminderText(lead: StoredLead): string {
  const days = Math.floor((Date.now() - new Date(lead.statusChangedAt).getTime()) / 86_400_000);
  return [
    `⚠️ Заявка #${lead.id} всё ещё в работе (${days} дн.)`,
    ``,
    `${escapeHtml(lead.name)} — ${escapeHtml(serviceLabel(lead.service))}`,
  ].join('\n');
}

export function dealNotificationText(lead: StoredLead & { dealAmount: number }): string {
  const { commission } = getCommission(lead);
  return [
    `💰 Новая сделка`,
    ``,
    `#${lead.id} ${escapeHtml(lead.name)}`,
    ``,
    `Сумма сделки: ${formatMoney(lead.dealAmount)}`,
    `Комиссия (${lead.commissionPercent}%): ${formatMoney(commission)}`,
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

// Bold header on every branch, including the empty state — consecutive
// standalone bot replies (debt/deals/stats) show no visual gap in Telegram,
// so a bold first line is what keeps them from reading as one wall of text.
export function buildOwedSummary(rows: OwedRow[], total: number): string {
  if (rows.length === 0) return '<b>🔴 Мне должны</b>\n\n🟢 Всё оплачено, долгов нет.';
  const lines = rows.map(r => `#${r.id} ${escapeHtml(r.name)} — ${formatMoney(r.remaining)}`);
  return ['<b>🔴 Мне должны</b>', ``, ...lines, ``, `Итого: ${formatMoney(total)}`].join('\n');
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
    return `#${l.id} ${escapeHtml(l.name)}\n${formatMoney(l.dealAmount)} · комиссия ${formatMoney(info.commission)}\n${paidStatusMark(l, info)}`;
  });
  return ['<b>💰 Все сделки</b>', ...lines].join('\n\n');
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

// Owner's money view lives inside each lead's detail, not a menu item.
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
    '<b>📊 Статистика</b>',
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

function moneyStatusLines(lead: StoredLead, info: CommissionInfo): string[] {
  const lines = [
    '',
    `🧾 Оплата клиента: ${lead.customerPaidAt ? '✅ отмечена' : '⏳ не отмечена'}`,
    `💰 Комиссия Zikrasoft: ${formatMoney(info.commission)} · ${info.isPaidOff ? '🟢 Оплачено' : `Осталось: ${formatMoney(info.remaining)}`}`,
  ];
  if (lead.pendingCommissionClaim) lines.push(`🕓 Ожидает подтверждения: ${formatMoney(lead.pendingCommissionClaim.amount)}`);
  return lines;
}

function moneyActionRows(lead: StoredLead, role: Role, info: CommissionInfo): Btn[][] {
  if (role === 'owner') {
    const rows: Btn[][] = [[{ text: lead.customerPaidAt ? '↩️ Клиент не оплатил' : '✅ Клиент оплатил', callback_data: `custpaid:${lead.id}` }]];
    if (!info.isPaidOff && !lead.pendingCommissionClaim) {
      rows.push([{ text: '💸 Отметить оплату комиссии', callback_data: `claimpay:${lead.id}` }]);
    }
    return rows;
  }
  return lead.pendingCommissionClaim
    ? [[{ text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` }, { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` }]]
    : [];
}

export function buildLeadDetail(lead: StoredLead, role: Role): { text: string; reply_markup: Keyboard } {
  if (lead.archived) {
    return {
      text: `${formatLeadText(lead)}\n\n🗄 В архиве`,
      reply_markup: { inline_keyboard: [[{ text: '♻️ Восстановить', callback_data: `unarch:${lead.id}` }]] },
    };
  }

  const commission = lead.status === 'won' && lead.dealAmount != null ? getCommission(lead) : null;
  const lines = [formatLeadText(lead), ...(commission ? moneyStatusLines(lead, commission) : [])];
  const rows: Btn[][] = [
    ...buildStatusKeyboard(lead).inline_keyboard,
    [
      { text: '✏️ Имя', callback_data: `edit:${lead.id}:name` },
      { text: '✏️ Контакт', callback_data: `edit:${lead.id}:contact` },
      { text: '✏️ Комментарий', callback_data: `edit:${lead.id}:comment` },
    ],
    ...(commission ? moneyActionRows(lead, role, commission) : []),
    [{ text: '🗑 Архивировать', callback_data: `arch:${lead.id}` }],
  ];

  return { text: lines.join('\n'), reply_markup: { inline_keyboard: rows } };
}
