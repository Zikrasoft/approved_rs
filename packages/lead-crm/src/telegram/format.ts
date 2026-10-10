import { format, parseISO } from 'date-fns';
import {
  getCommission,
  hasDealAmount,
  incomeCommission,
  roundMoney,
  unpaidIncomes,
  type CommissionInfo,
} from '../money.ts';
import { channelLabel } from '../channelLabels.ts';
import { isTelegramIdContact } from '../contactShape.ts';
import { LEADS_PATH } from '../quarantine.ts';
import {
  isClosed,
  type Income,
  type LeadStatus,
  type StoredLead,
} from '../schema.ts';
import { MAX_LIST_ROWS, isPlaceholderContact } from '../store.ts';
import type { LedgerAuthor, Payout } from '../ledger.ts';

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

const STATUS_META: Record<LeadStatus, { emoji: string; label: string }> = {
  open: { emoji: '🔵', label: 'Открыта' },
  won: { emoji: '✅', label: 'Сделка' },
  lost: { emoji: '❌', label: 'Отказ' },
  postponed: { emoji: '⏸️', label: 'Отложена' },
};

function statusMark(status: LeadStatus): string {
  const { emoji, label } = STATUS_META[status];
  return `${emoji} ${label}`;
}

function statusLine(status: LeadStatus): string {
  return `<b>Статус: ${statusMark(status)}</b>`;
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

export function canAddIncome(lead: StoredLead, role: Role): boolean {
  return role === 'owner' && lead.status !== 'lost';
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

function statusRows(lead: StoredLead, role: Role): Btn[][] {
  if (lead.status === 'postponed')
    return [[{ text: '▶️ Возобновить', callback_data: `resume:${lead.id}` }]];
  if (lead.status !== 'open' || role !== 'owner') return [];
  return [
    [
      { text: '✅ Сделка', callback_data: `st:${lead.id}:won` },
      { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
    ],
    [{ text: '⏰ Отложить', callback_data: `postpone:${lead.id}` }],
  ];
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

export function buildOpenList(leads: StoredLead[]): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = leads
    .filter((l) => !isClosed(l))
    .sort((a, b) => b.id - a.id)
    .slice(0, MAX_LIST_ROWS)
    .map((l) => [
      {
        text: `#${l.id} ${leadDisplayName(l)} · ${l.brand} · ${STATUS_META[l.status].emoji}`,
        callback_data: `open:${l.id}`,
      },
    ]);
  return {
    text: rows.length ? 'Выберите заявку:' : 'Открытых заявок нет.',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildMenu(role: Role): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = [
    [{ text: '📂 Открытые', callback_data: 'menu:open' }],
    [{ text: '💶 К оплате', callback_data: 'menu:debt' }],
  ];
  if (role === 'admin')
    rows.push([{ text: '📊 Статистика', callback_data: 'menu:stats' }]);
  return {
    text: '📋 Заявки\n\nЧтобы найти заявку, пришли имя, телефон или #номер — найдёт и отказы.',
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildToPay(balance: number): string {
  return `<b>💶 К оплате</b>\n\n${formatMoney(balance)}`;
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
    const label = `${STATUS_META[l.status].emoji} #${l.id} ${l.brand} ${leadDisplayName(l)} — ${l.contact}${amount}`;
    return [{ text: label, callback_data: `open:${l.id}` }];
  });
  return { text: 'Найдено:', reply_markup: { inline_keyboard: rows } };
}

export function buildStats(leads: StoredLead[]): string {
  const count = (s: LeadStatus) => leads.filter((l) => l.status === s).length;
  const earningLeads = leads.filter(hasDealAmount);
  const sum = (pick: (l: StoredLead & { dealAmount: number }) => number) =>
    roundMoney(earningLeads.reduce((acc, l) => acc + pick(l), 0));

  const brands = [...new Set(leads.map((l) => l.brand))].sort();
  const brandLines =
    brands.length > 1
      ? [
          `По брендам: ${brands
            .map(
              (b) =>
                `${escapeHtml(b)} — ${leads.filter((l) => l.brand === b).length}`,
            )
            .join(' · ')}`,
        ]
      : [];

  return [
    '<b>📊 Статистика</b>',
    '',
    `Всего заявок: ${leads.length}`,
    (['open', 'postponed', 'won', 'lost'] as const)
      .map((s) => `${statusMark(s)}: ${count(s)}`)
      .join('   '),
    ...brandLines,
    '',
    `💰 Заработано (доход владельца): ${formatMoney(sum((l) => l.dealAmount))}`,
    `Комиссия начислена: ${formatMoney(sum((l) => getCommission(l).commission))}`,
    `Оплачено: ${formatMoney(sum((l) => l.paidAmount))}`,
    `🔴 Осталось получить: ${formatMoney(sum((l) => getCommission(l).remaining))}`,
  ].join('\n');
}

export function commissionResultText(
  leadId: number,
  confirmed: boolean,
): string {
  return confirmed
    ? `✅ Оплата по заявке #${leadId} подтверждена.`
    : `❌ Оплата по заявке #${leadId} не подтверждена, свяжитесь с администратором.`;
}

export function commissionClaimText(
  lead: StoredLead & {
    pendingCommissionClaim: NonNullable<StoredLead['pendingCommissionClaim']>;
  },
): string {
  return `🔔 Отмечена оплата комиссии по заявке #${lead.id}: ${formatMoney(lead.pendingCommissionClaim.amount)}.\n\nПодтвердить?`;
}

export const EDIT_FIELD_LABELS = {
  name: 'имя',
  contact: 'контакт',
  comment: 'комментарий',
  service: 'услуга',
} as const;

export type EditField = keyof typeof EDIT_FIELD_LABELS;

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
  return `🔔 Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: статус — ${statusMark(lead.status)}`;
}

const LEDGER_AUTHOR_LABELS: Record<LedgerAuthor, string> = {
  owner: 'владелец',
  admin: 'админ',
};

export function payoutNotificationText(
  lead: StoredLead,
  payout: Payout,
): string {
  const last = payout.edits.at(-1);
  return [
    `${last ? '✏️ Исправлена выплата' : '💶 Новая выплата'} по заявке #${lead.id} ${escapeHtml(leadDisplayName(lead))}`,
    `Записал: ${LEDGER_AUTHOR_LABELS[last?.by ?? payout.createdBy]}`,
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
    if (lead.pendingCommissionClaim)
      lines.push(
        `🕓 Ожидает подтверждения: ${formatMoney(lead.pendingCommissionClaim.amount)}`,
      );
    return lines;
  }

  function moneyActionRows(
    lead: StoredLead,
    role: Role,
    info: CommissionInfo,
  ): Btn[][] {
    if (role === 'owner') {
      if (info.isPaidOff || lead.pendingCommissionClaim) return [];
      const unpaid = unpaidIncomes(lead);
      const rows: Btn[][] = unpaid.map((i) => [
        {
          text: `💸 Оплатил ${formatMoney(incomeCommission(i.amount, lead.commissionPercent))} с ${formatMoney(i.amount)} от ${formatDateRu(i.at)}`,
          callback_data: `claimpay:${lead.id}:${i.id}`,
        },
      ]);
      if (unpaid.length > 1) {
        rows.unshift([
          {
            text: `💸 Оплатил всё — ${formatMoney(info.remaining)}`,
            callback_data: `claimpay:${lead.id}`,
          },
        ]);
      }
      return rows;
    }
    return lead.pendingCommissionClaim
      ? [
          [
            { text: '✅ Подтвердить', callback_data: `confirmpay:${lead.id}` },
            { text: '❌ Отклонить', callback_data: `rejectpay:${lead.id}` },
          ],
        ]
      : [];
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
      return `🚗 Заявка #${lead.id} · ${escapeHtml(leadDisplayName(lead))} · ${escapeHtml(servicesLabel(lead))} · ${statusMark(lead.status)}\n${brandLine(lead)}`;
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
          '<b>Карточка в группе</b>',
          '✅ Сделка — бот спросит, сколько переведёшь админу (0 — если ничего). ❌ Отказ — заявка уходит из списков. ⏳ В работе — отметить, что занимаешься.',
          'Ответь на карточку суммой — запишется выплата, любым другим текстом — заметка. Сумму можно поправить кнопкой ✏️ Исправить.',
          '',
          '<b>В боте</b>',
          '📂 Открыть в боте — вся заявка: ⏰ Отложить до даты (в этот день вернётся в открытые) и 💬 ответить посетителю через бота.',
          '',
          '<b>Меню</b>',
          '📂 Открытые, 💶 К оплате. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
        ].join('\n');
      }
      return [
        '<b>❓ Как пользоваться</b>',
        '',
        'Заявки ведёт владелец: ✅ Сделка, ❌ Отказ, ⏳ В работе на карточке в группе. О каждой выплате тебе приходит уведомление.',
        '',
        '<b>Меню</b>',
        '📂 Открытые, 💶 К оплате, 📊 Статистика. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
        '',
        '<b>Удаление</b>',
        '❌ Удалить навсегда — только у тебя. Спросит подтверждение и стирает заявку без возврата.',
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

      const commission = hasDealAmount(lead) ? getCommission(lead) : null;
      const lines = [
        formatLeadText(lead, role),
        ...(commission ? moneyStatusLines(lead, commission) : []),
      ];
      const rows: Btn[][] = [
        ...statusRows(lead, role),
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
        ...(commission ? moneyActionRows(lead, role, commission) : []),
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
