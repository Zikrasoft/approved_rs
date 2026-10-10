import { format, parseISO } from 'date-fns';
import {
  getCommission,
  hasDealAmount,
  incomeCommission,
  roundMoney,
  type CommissionInfo,
} from '../money.ts';
import { channelLabel } from '../channelLabels.ts';
import { isTelegramIdContact } from '../contactShape.ts';
import { LEADS_PATH } from '../quarantine.ts';
import type { Income, LeadStatus, StoredLead } from '../schema.ts';
import { MAX_LIST_ROWS, isPlaceholderContact } from '../store.ts';
import type { Draft, LedgerAuthor, Payout, Settlement } from '../ledger.ts';

export type Role = 'owner' | 'admin';

export type Btn = { text: string } & (
  | { callback_data: string; url?: never }
  | { url: string; callback_data?: never }
);
export type Keyboard = { inline_keyboard: Btn[][] };

export interface FormatterOptions {
  serviceLabel: (slug: string) => string;
  botUsername: string;
  replyRelayBrands?: readonly string[];
}

const MAX_SERVICES_LABEL = 200;

export const leadDisplayName = (lead: { name: string }): string =>
  lead.name || '—';

export const LEAD_STATUS_ACTIONS = [
  { key: 'negotiations', emoji: '🗣', label: 'Переговоры' },
  { key: 'in_progress', emoji: '🔵', label: 'В работе' },
  { key: 'won', emoji: '✅', label: 'Успешно' },
  { key: 'lost', emoji: '❌', label: 'Отказ' },
] as const;
export type LeadStatusKey = (typeof LEAD_STATUS_ACTIONS)[number]['key'];

const NEW_STATUS_META = { emoji: '🆕', label: 'Новая' } as const;
const POSTPONED_STATUS_META = { emoji: '⏸️', label: 'Отложена' } as const;
const UNKNOWN_STATUS_META = { emoji: '⚪' };

function statusMeta(status: LeadStatus): { emoji: string; label: string } {
  if (status === 'new') return NEW_STATUS_META;
  if (status === 'postponed') return POSTPONED_STATUS_META;
  const found = LEAD_STATUS_ACTIONS.find((s) => s.key === status);
  return found ?? { ...UNKNOWN_STATUS_META, label: status };
}

export function statusLabel(status: LeadStatus): string {
  return statusMeta(status).label;
}

function statusEmoji(status: LeadStatus): string {
  return statusMeta(status).emoji;
}

function archivedMark(lead: StoredLead): string {
  return lead.archived ? '🗄 ' : '';
}

function statusLine(status: LeadStatus): string {
  return `<b>Статус: ${statusEmoji(status)} ${statusLabel(status)}</b>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(n)} €`;
}

export function formatDateRu(iso: string): string {
  return format(parseISO(iso), 'dd.MM.yyyy');
}

const INCOME_STATUSES: LeadStatus[] = [
  'negotiations',
  'in_progress',
  'postponed',
  'won',
];

export function canAddIncome(lead: StoredLead, role: Role): boolean {
  return (
    role === 'owner' && !lead.archived && INCOME_STATUSES.includes(lead.status)
  );
}

function incomeLine(lead: StoredLead, income: Income): string {
  const commission = incomeCommission(income.amount, lead.commissionPercent);
  return `• ${formatMoney(income.amount)} от ${formatDateRu(income.at)} · комиссия ${formatMoney(commission)} · ${income.paidAt ? '🟢 оплачена' : '🔴 не оплачена'}`;
}

const QUICK_REMIND_DAYS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 3 дня', days: 3 },
  { label: 'Через неделю', days: 7 },
  { label: 'Через 2 недели', days: 14 },
  { label: 'Через месяц', days: 30 },
] as const;

export function buildRemindPicker(id: number): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = QUICK_REMIND_DAYS.map((o) => [
    { text: o.label, callback_data: `remindpick:${id}:${o.days}` },
  ]);
  rows.push([{ text: '✍️ Своя дата', callback_data: `remindtype:${id}` }]);
  rows.push([{ text: '◀️ Назад', callback_data: `remindcancel:${id}` }]);
  return {
    text: '⏰ Когда напомнить?',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildStatusKeyboard(lead: StoredLead, role: Role): Keyboard {
  if (lead.status === 'new') {
    const row: Btn[] = [
      { text: '🗣 Переговоры', callback_data: `st:${lead.id}:negotiations` },
    ];
    if (role === 'owner')
      row.push({ text: '❌ Отказ', callback_data: `st:${lead.id}:lost` });
    return { inline_keyboard: [row] };
  }
  if (lead.status === 'negotiations') {
    const row: Btn[] = [
      { text: '🔵 В работу', callback_data: `st:${lead.id}:in_progress` },
    ];
    if (role !== 'owner') return { inline_keyboard: [row] };
    row.push({ text: '❌ Отказ', callback_data: `st:${lead.id}:lost` });
    return {
      inline_keyboard: [
        row,
        [{ text: '⏰ Отложить', callback_data: `postpone:${lead.id}` }],
      ],
    };
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
    return {
      inline_keyboard: [
        [{ text: '▶️ Возобновить', callback_data: `resume:${lead.id}` }],
      ],
    };
  }
  return { inline_keyboard: [] };
}

export function buildDeleteConfirm(lead: StoredLead): {
  text: string;
  reply_markup: Keyboard;
} {
  return {
    text: `❗ Удалить заявку #${lead.id} (${escapeHtml(leadDisplayName(lead))}) навсегда? Это нельзя отменить.`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Да, удалить', callback_data: `delconfirm:${lead.id}` },
          { text: '↩️ Отмена', callback_data: `delcancel:${lead.id}` },
        ],
      ],
    },
  };
}

export function buildLeadList(
  leads: StoredLead[],
  status: LeadStatus | LeadStatus[],
): { text: string; reply_markup: Keyboard } {
  const statuses = Array.isArray(status) ? status : [status];
  const rows: Btn[][] = leads
    .filter((l) => statuses.includes(l.status) && !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS)
    .map((l) => [
      {
        text: `#${l.id} ${leadDisplayName(l)} · ${l.brand} · ${statusEmoji(l.status)}`,
        callback_data: `open:${l.id}`,
      },
    ]);
  return {
    text: rows.length ? 'Выберите заявку:' : 'Пусто.',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildMenu(role: Role): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = [
    [{ text: '🆕 Новые', callback_data: 'list:new' }],
    [{ text: '🗣 Переговоры', callback_data: 'list:negotiations' }],
    [
      {
        text: '🔵 В работе / Отложенные',
        callback_data: 'list:in_progress+postponed',
      },
    ],
    [{ text: '✅ Успешные', callback_data: 'list:won' }],
    [{ text: '❌ Отказы', callback_data: 'list:lost' }],
    [{ text: '📊 Статистика', callback_data: 'menu:stats' }],
  ];
  rows.push([
    {
      text: role === 'owner' ? '🔴 Мой долг по комиссии' : '🔴 Мне должны',
      callback_data: 'menu:debt',
    },
  ]);
  if (role === 'admin') {
    rows.push([{ text: '💰 Все сделки', callback_data: 'menu:deals' }]);
  }
  return {
    text: '📋 Заявки\n\nМожно также прислать имя, телефон или #номер заявки для поиска (найдёт и архивные).',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildToPay(balance: number): string {
  return `<b>💶 К оплате</b>\n\n${formatMoney(balance)}`;
}

export const SETTLEMENT_COPY = {
  otherButton: '✏️ Другая сумма',
  prompt: '💸 Сколько получено (в евро)?\n\nНапример: 200',
  ack: 'Жду сумму',
  stale: 'Сумма к оплате изменилась',
} as const;

export function settleKeyboard(balance: number): Keyboard {
  return {
    inline_keyboard: [
      ...(balance > 0
        ? [
            [
              {
                text: `💸 Оплачено ${formatMoney(balance)}`,
                callback_data: `settle:${balance}`,
              },
            ],
          ]
        : []),
      [{ text: SETTLEMENT_COPY.otherButton, callback_data: 'settle:other' }],
    ],
  };
}

export function settlementText(
  settlement: Settlement,
  balance: number,
): string {
  return `💸 Оплата получена: ${formatMoney(settlement.amount)}\nОсталось к оплате: ${formatMoney(balance)}`;
}

function paidStatusMark(
  l: StoredLead & { dealAmount: number },
  info: CommissionInfo,
): string {
  if (info.isPaidOff) return '🟢 Оплачено';
  if (l.paidAmount > 0)
    return `🟡 Оплачено ${formatMoney(l.paidAmount)} из ${formatMoney(info.commission)}`;
  return '🔴 Не оплачено';
}

export function formatDealsList(leads: StoredLead[]): string {
  const deals = leads
    .filter(hasDealAmount)
    .filter((l) => !l.archived)
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS);
  if (deals.length === 0) return '<b>💰 Все сделки</b>\n\nСделок пока нет.';
  const lines = deals.map((l) => {
    const info = getCommission(l);
    return `#${l.id} ${escapeHtml(leadDisplayName(l))} · ${escapeHtml(l.brand)}\nдоход ${formatMoney(l.dealAmount)} · комиссия ${formatMoney(info.commission)}\n${paidStatusMark(l, info)}`;
  });
  return ['<b>💰 Все сделки</b>', ...lines].join('\n\n');
}

export function buildSearchResults(leads: StoredLead[]): {
  text: string;
  reply_markup: Keyboard;
} {
  if (leads.length === 0)
    return {
      text: 'Ничего не найдено.',
      reply_markup: { inline_keyboard: [] },
    };
  const rows: Btn[][] = leads.slice(0, MAX_LIST_ROWS).map((l) => {
    const amount =
      l.dealAmount != null ? ` — ${formatMoney(l.dealAmount)}` : '';
    const label = `${archivedMark(l)}${statusEmoji(l.status)} #${l.id} ${l.brand} ${leadDisplayName(l)} — ${l.contact}${amount}`;
    return [{ text: label, callback_data: `open:${l.id}` }];
  });
  return { text: 'Найдено:', reply_markup: { inline_keyboard: rows } };
}

export function buildStats(leads: StoredLead[], role: Role): string {
  const active = leads.filter((l) => !l.archived);
  const archivedCount = leads.length - active.length;
  const count = (s: LeadStatus) => active.filter((l) => l.status === s).length;
  const earningLeads = active.filter(hasDealAmount);
  const sum = (pick: (l: StoredLead & { dealAmount: number }) => number) =>
    roundMoney(earningLeads.reduce((acc, l) => acc + pick(l), 0));

  const totalEarned = sum((l) => l.dealAmount);
  const commissionTotal = sum((l) => getCommission(l).commission);
  const paidTotal = sum((l) => l.paidAmount);
  const remainingTotal = sum((l) => getCommission(l).remaining);

  const moneyLines =
    role === 'owner'
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

  const brands = [...new Set(active.map((l) => l.brand))].sort();
  const brandLines =
    brands.length > 1
      ? [
          `По брендам: ${brands
            .map(
              (b) =>
                `${escapeHtml(b)} — ${active.filter((l) => l.brand === b).length}`,
            )
            .join(' · ')}`,
        ]
      : [];

  return [
    '<b>📊 Статистика</b>',
    '',
    `Всего заявок: ${active.length}${archivedCount ? ` (+${archivedCount} в архиве)` : ''}`,
    `🆕 Новые: ${count('new')}   🗣 Переговоры: ${count('negotiations')}   🔵 В работе: ${count('in_progress')}   ✅ Завершено: ${count('won')}   ❌ Отказ: ${count('lost')}   ⏸ Отложено: ${count('postponed')}`,
    ...brandLines,
    '',
    ...moneyLines,
  ].join('\n');
}

export const EDIT_FIELD_LABELS = {
  name: 'имя',
  contact: 'контакт',
  comment: 'комментарий',
  service: 'услуга',
} as const;

export type EditField = keyof typeof EDIT_FIELD_LABELS;

export const EDIT_COPY = {
  prompt: (field: EditField) =>
    `✏️ Введите новое значение (${EDIT_FIELD_LABELS[field]}):`,
  ack: 'Жду значение',
} as const;

export const REPLY_COPY = {
  prompt: '💬 Напишите ответ посетителю — бот отправит его в чат:',
  ack: 'Жду сообщение',
  empty: '⚠️ Сообщение не может быть пустым. Попробуйте ещё раз.',
  undelivered:
    '⚠️ Не доставлено: посетитель заблокировал бота или чат недоступен.',
  sent: '✅ Отправлено',
  notePrefix: 'Ответ: ',
} as const;

export const OUTCOME_COPY = {
  wonPrompt:
    '💰 Сколько переведёшь админу с этой заявки (в евро)? Ответь на это сообщение суммой.\n\nДеньги будут позже — просто не отвечай. Ничего не будет — ответь 0.',
  wonAck: 'Сделка ✅ — жду сумму',
  workAck: 'В работе ⏳',
  badAmount: '⚠️ Нужна сумма в евро. Попробуйте ещё раз.',
} as const;

const FIELD_PREVIEW_LIMIT = 120;

function fieldPreview(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (!text) return '—';
  return escapeHtml(
    text.length <= FIELD_PREVIEW_LIMIT
      ? text
      : `${text.slice(0, FIELD_PREVIEW_LIMIT)}…`,
  );
}

export type FieldChangeAuthor = 'operator' | 'visitor';

export const REFERRAL_NOTE = 'Пришёл из бота Approved.rs (Партнёры)';

const VISITOR_CHANGE_MARK = '🤖 Посетитель через бота';

export function quarantinedLeadsText(
  count: number,
  path: string,
  brand: string,
): string {
  return [
    `⚠️ Нечитаемых заявок: ${count}`,
    ``,
    `Нашёл сайт ${escapeHtml(brand)} и скопировал в ${escapeHtml(path)}.`,
    `Из ${escapeHtml(LEADS_PATH)} ничего не убирал — удалить можно только руками.`,
  ].join('\n');
}

export function statusChangeText(lead: StoredLead): string {
  const meta = statusMeta(lead.status);
  return `🔔 Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: статус — ${meta.emoji} ${meta.label}`;
}

const LEDGER_AUTHOR_LABELS: Record<LedgerAuthor, string> = {
  owner: 'владелец',
  admin: 'админ',
};

function payoutSubject(
  lead: StoredLead | undefined,
  brand: string | null,
): string {
  if (lead) return `по заявке #${lead.id} ${escapeHtml(leadDisplayName(lead))}`;
  return brand ? `без заявки · ${escapeHtml(brand)}` : 'без заявки';
}

function noteLines(note: string): string[] {
  return note ? [`За что: ${escapeHtml(note)}`] : [];
}

export function payoutNotificationText(
  lead: StoredLead | undefined,
  payout: Payout,
): string {
  const last = payout.edits.at(-1);
  return [
    `${last ? '✏️ Исправлена выплата' : '💶 Новая выплата'} ${payoutSubject(lead, payout.brand)}`,
    `Записал: ${LEDGER_AUTHOR_LABELS[last?.by ?? payout.createdBy]}`,
    ...noteLines(payout.note),
    ``,
    `Было: ${last ? formatMoney(last.before) : '—'}`,
    `Стало: ${formatMoney(payout.amount)}`,
  ].join('\n');
}

export const PAYOUT_COPY = {
  fixButton: '✏️ Исправить',
  fixPrompt: '✏️ Какая сумма верная (в евро)?\n\nНапример: 80',
  fixAck: 'Жду сумму',
  invalidAmount: '⚠️ Нужна сумма в евро. Попробуйте ещё раз.',
  settled:
    '🔒 Эта выплата уже вошла в расчёт — исправить её может только админ.',
  noteAdded: '📝 Заметка добавлена',
} as const;

export function payoutRecordedMessage(payout: Payout): {
  text: string;
  reply_markup: Keyboard;
} {
  return {
    text: `✅ ${formatMoney(payout.amount)} записано`,
    reply_markup: {
      inline_keyboard: [
        [{ text: PAYOUT_COPY.fixButton, callback_data: `payfix:${payout.id}` }],
      ],
    },
  };
}

export const DRAFT_COPY = {
  confirm: '✅ Верно',
  edit: '✏️ Исправить',
  discard: '✖ Не выплата',
  thatsHim: '👤 Это он',
  anotherClient: '🔄 Другой клиент',
  discarded: '✖ Не выплата — ничего не записано',
  unreadable:
    '⚠️ Не получилось разобрать сумму. Ответьте суммой на карточку заявки или напишите ещё раз.',
} as const;

export function draftMessage(
  draft: Draft,
  lead: StoredLead | undefined,
): { text: string; reply_markup: Keyboard } {
  const button = (text: string, action: string) => ({
    text,
    callback_data: `draft:${draft.id}:${action}`,
  });
  const client = lead
    ? `Клиент: #${lead.id} ${escapeHtml(leadDisplayName(lead))}${draft.matchPending ? ' — это он?' : ''}`
    : `Клиент: ${payoutSubject(undefined, draft.brand)}`;
  return {
    text: [
      `📝 Выплата: ${formatMoney(draft.amount)}`,
      ...noteLines(draft.note),
      client,
    ].join('\n'),
    reply_markup: {
      inline_keyboard: draft.matchPending
        ? [
            [
              button(DRAFT_COPY.thatsHim, 'him'),
              button(DRAFT_COPY.anotherClient, 'other'),
            ],
            [button(DRAFT_COPY.discard, 'no')],
          ]
        : [
            [
              button(DRAFT_COPY.confirm, 'ok'),
              button(DRAFT_COPY.edit, 'edit'),
              button(DRAFT_COPY.discard, 'no'),
            ],
          ],
    },
  };
}

export function dealNotificationText(
  lead: StoredLead & { dealAmount: number },
): string {
  const { commission } = getCommission(lead);
  return [
    `💰 Новая сделка`,
    ``,
    `#${lead.id} ${escapeHtml(leadDisplayName(lead))}`,
    ``,
    `Доход с заявки: ${formatMoney(lead.dealAmount)}`,
    `Твоя комиссия (${lead.commissionPercent}%): ${formatMoney(commission)}`,
  ].join('\n');
}

export function createFormatter({
  serviceLabel,
  botUsername,
  replyRelayBrands = [],
}: FormatterOptions) {
  const canReplyThroughBot = (lead: StoredLead): boolean =>
    replyRelayBrands.includes(lead.brand) && isTelegramIdContact(lead.contact);

  function clickLabel(lead: StoredLead): string {
    const channel = lead.contactChannel;
    return lead.kind === 'call_click' &&
      channel &&
      isPlaceholderContact(lead.contact)
      ? `Клик: ${channelLabel(channel)}`
      : '';
  }

  function servicesLabel(lead: StoredLead): string {
    const slugs = lead.services.length > 0 ? lead.services : [lead.service];
    const label = slugs.map(serviceLabel).filter(Boolean).join(' · ');
    return (label || clickLabel(lead) || '—').slice(0, MAX_SERVICES_LABEL);
  }

  function brandLine(lead: StoredLead): string {
    const via = lead.telegramId == null ? '' : ' · 🤖 через бота';
    const referred =
      lead.referredBy === 'approved' ? ' · 🤝 из бота Approved.rs' : '';
    return `🏷 ${escapeHtml(lead.brand)}${via}${referred}`;
  }

  function formatLeadText(lead: StoredLead, role: Role): string {
    const contactLine = lead.contactChannel
      ? `${lead.contact} (${channelLabel(lead.contactChannel)})`
      : lead.contact;
    const lines: string[] = [
      `🚗 Заявка #${lead.id} — ${escapeHtml(servicesLabel(lead))}`,
      brandLine(lead),
      statusLine(lead.status),
    ];
    if (lead.dealAmount != null) {
      lines.push(
        role === 'owner'
          ? `💰 Твой доход с заявки: ${formatMoney(lead.dealAmount)}`
          : `💰 Доход владельца с заявки: ${formatMoney(lead.dealAmount)}`,
      );
    }
    if (lead.status === 'postponed' && lead.remindAt)
      lines.push(`⏰ Напомнить: ${formatDateRu(lead.remindAt)}`);
    lines.push(
      ``,
      `Имя: ${escapeHtml(leadDisplayName(lead))}`,
      `Контакт: ${escapeHtml(contactLine)}`,
    );
    if (lead.country)
      lines.push(`Страна: ${escapeHtml(lead.country.toUpperCase())}`);
    if (lead.comment) lines.push(`Комментарий: ${escapeHtml(lead.comment)}`);
    if (lead.source_url) lines.push(`Страница: ${escapeHtml(lead.source_url)}`);
    if (lead.visitorId)
      lines.push(`ID посетителя: ${escapeHtml(lead.visitorId.slice(0, 100))}`);
    lines.push(``, `#заявка`);
    return lines.join('\n');
  }

  function moneyStatusLines(lead: StoredLead, info: CommissionInfo): string[] {
    const lines = [
      '',
      ...(lead.incomes.length
        ? ['💶 Доходы:', ...lead.incomes.map((i) => incomeLine(lead, i)), '']
        : []),
      `💰 Комиссия Zikrasoft: ${formatMoney(info.commission)} · ${info.isPaidOff ? '🟢 Оплачено' : `Осталось: ${formatMoney(info.remaining)}`}`,
    ];
    return lines;
  }

  function shownValue(
    field: EditField,
    value: string | null | undefined,
  ): string | null | undefined {
    return field === 'service' && value ? serviceLabel(value) : value;
  }

  return {
    formatLeadText,

    fieldChangeText(
      lead: StoredLead,
      field: EditField,
      before: string | null | undefined,
      author: FieldChangeAuthor = 'operator',
    ): string {
      return [
        `✏️ Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: ${EDIT_FIELD_LABELS[field]}`,
        ...(author === 'visitor' ? [VISITOR_CHANGE_MARK] : []),
        ``,
        `Было: ${fieldPreview(shownValue(field, before))}`,
        `Стало: ${fieldPreview(shownValue(field, lead[field]))}`,
      ].join('\n');
    },

    formatTeaser(lead: StoredLead): string {
      return `${archivedMark(lead)}🚗 Заявка #${lead.id} · ${escapeHtml(leadDisplayName(lead))} · ${escapeHtml(servicesLabel(lead))} · ${statusEmoji(lead.status)} ${statusLabel(lead.status)}\n${brandLine(lead)}`;
    },

    deepLinkKeyboard(id: number): Keyboard {
      return {
        inline_keyboard: [
          [
            {
              text: '📂 Открыть в боте',
              url: `https://t.me/${botUsername}?start=lead_${id}`,
            },
          ],
          [
            { text: '✅ Сделка', callback_data: `won:${id}` },
            { text: '❌ Отказ', callback_data: `lost:${id}` },
            { text: '⏳ В работе', callback_data: `work:${id}` },
          ],
        ],
      };
    },

    postponeReminderText(lead: StoredLead): string {
      return [
        `⏰ Напоминание по заявке #${lead.id}`,
        ``,
        `${escapeHtml(leadDisplayName(lead))} — ${escapeHtml(servicesLabel(lead))}`,
        `Ты просил напомнить сегодня — заявка снова активна.`,
      ].join('\n');
    },

    buildHelp(role: Role): string {
      if (role === 'owner') {
        return [
          '<b>❓ Как пользоваться</b>',
          '',
          '<b>Заявки</b>',
          '🆕 Новая → 🗣 Переговоры → 🔵 В работу → ✅ Завершить (укажи свою прибыль в €) или ❌ Отказ.',
          'Не договорились сейчас? ⏰ Отложить — укажи дату (ДД.ММ.ГГГГ), заявка сама вернётся на прежний этап в этот день, или жми ▶️ Возобновить раньше.',
          'В заявке можно поправить имя/контакт/комментарий или архивировать.',
          '',
          '<b>Деньги</b>',
          'Получил предоплату или частичный расчёт — ➕ Добавить доход прямо в работе, сколько угодно раз.',
          'При ✅ Завершить бот спросит, сколько ты заработал сверх уже добавленного (0 — если больше ничего).',
          '',
          '<b>Комиссия</b>',
          'Ставка указана в самой заявке — она своя у каждого бизнеса. Считается с каждого дохода отдельно.',
          'Кнопка 💸 Оплатил — своя на каждый неоплаченный доход, плюс 💸 Оплатил всё, если их несколько. Админ подтвердит или отклонит.',
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
    },

    buildLeadDetail(
      lead: StoredLead,
      role: Role,
    ): { text: string; reply_markup: Keyboard } {
      const deleteRow: Btn[][] =
        role === 'admin'
          ? [[{ text: '❌ Удалить навсегда', callback_data: `del:${lead.id}` }]]
          : [];

      if (lead.archived) {
        return {
          text: `${formatLeadText(lead, role)}\n\n🗄 В архиве`,
          reply_markup: {
            inline_keyboard: [
              [{ text: '♻️ Восстановить', callback_data: `unarch:${lead.id}` }],
              ...deleteRow,
            ],
          },
        };
      }

      const commission = hasDealAmount(lead) ? getCommission(lead) : null;
      const lines = [
        formatLeadText(lead, role),
        ...(commission ? moneyStatusLines(lead, commission) : []),
      ];
      const rows: Btn[][] = [
        ...buildStatusKeyboard(lead, role).inline_keyboard,
        ...(canAddIncome(lead, role)
          ? [
              [
                {
                  text: '➕ Добавить доход',
                  callback_data: `income:${lead.id}`,
                },
              ],
            ]
          : []),
        [
          { text: '✏️ Имя', callback_data: `edit:${lead.id}:name` },
          { text: '✏️ Контакт', callback_data: `edit:${lead.id}:contact` },
          { text: '✏️ Комментарий', callback_data: `edit:${lead.id}:comment` },
        ],
        ...(canReplyThroughBot(lead)
          ? [
              [
                {
                  text: '💬 Ответить через бота',
                  callback_data: `reply:${lead.id}`,
                },
              ],
            ]
          : []),
        [{ text: '🗑 Архивировать', callback_data: `arch:${lead.id}` }],
        ...deleteRow,
      ];

      return {
        text: lines.join('\n'),
        reply_markup: { inline_keyboard: rows },
      };
    },
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
