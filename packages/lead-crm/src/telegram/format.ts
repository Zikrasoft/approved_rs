import { format, parseISO } from 'date-fns';
import { channelLabel } from '../channelLabels.ts';
import { isTelegramIdContact } from '../contactShape.ts';
import { LEADS_PATH } from '../quarantine.ts';
import { isClosed, type LeadStatus, type StoredLead } from '../schema.ts';
import { MAX_LIST_ROWS, isPlaceholderContact, type Digest } from '../store.ts';
import {
  LEDGER_TIME_ZONE,
  balanceOf,
  operationSums,
  type FlowSums,
  type LedgerAuthor,
  type LedgerOperation,
  type OperationType,
} from '../ledgerStore.ts';
import {
  MAX_OPERATION_AMOUNT,
  type OperationRefusal,
} from '../operationReply.ts';

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

export const LEDGER_COPY = {
  credit: '➕ Зачислить',
  debit: '➖ Списать',
  prompt: {
    payout: '➕ Сколько зачислить (в евро)?\n\nНапример: 40 или 40 Иван сервис',
    settlement: '➖ Сколько списать (в евро)?\n\nНапример: 40 или 40 перевод',
  },
  ack: 'Жду сумму',
  badAmount: '⚠️ Нужна сумма числом.',
  amountLimits: `⚠️ Сумма — от 0,01 до ${formatMoney(MAX_OPERATION_AMOUNT)}, не больше двух знаков после запятой.`,
} as const;

const BALANCE_LABELS: Record<Role, string> = {
  owner: '💶 Мой долг',
  admin: '💶 Мне должны',
};

const LEDGER_ROW: Btn[] = [
  { text: LEDGER_COPY.credit, callback_data: 'ledger:payout' },
  { text: LEDGER_COPY.debit, callback_data: 'ledger:settlement' },
];

function balanceLine(role: Role, balance: number): string {
  return `<b>${BALANCE_LABELS[role]}: ${formatMoney(balance)}</b>`;
}

export function buildMenu(
  role: Role,
  balance: number,
): {
  text: string;
  reply_markup: Keyboard;
} {
  const rows: Btn[][] = [
    LEDGER_ROW,
    [{ text: '📂 Открытые', callback_data: 'menu:open' }],
  ];
  if (role === 'admin')
    rows.push([{ text: '📊 Статистика', callback_data: 'menu:stats' }]);
  return {
    text: `${balanceLine(role, balance)}\n\n📋 Чтобы найти заявку, пришли имя, телефон или #номер — найдёт и отказы.`,
    reply_markup: { inline_keyboard: rows },
  };
}

export function buildBalance(
  role: Role,
  balance: number,
): { text: string; reply_markup: Keyboard } {
  return {
    text: balanceLine(role, balance),
    reply_markup: { inline_keyboard: [LEDGER_ROW] },
  };
}

const RE_ASK: Record<OperationRefusal, string> = {
  no_number: LEDGER_COPY.badAmount,
  bad_amount: LEDGER_COPY.amountLimits,
};

export function reAskOperationText(
  type: OperationType,
  reason: OperationRefusal,
): string {
  return `${RE_ASK[reason]}\n\n${LEDGER_COPY.prompt[type]}`;
}

function signedMoney({ type, amount }: LedgerOperation): string {
  return `${type === 'payout' ? '+' : '−'}${formatMoney(amount)}`;
}

export function operationRecordedText(
  operation: LedgerOperation,
  balance: number,
): string {
  return `✅ ${signedMoney(operation)} · баланс ${formatMoney(balance)}`;
}

export function operationRefusedText(balance: number): string {
  return `⚠️ Списать можно не больше баланса: ${formatMoney(balance)}`;
}

const OPERATION_AUTHORS: Record<LedgerAuthor, string> = {
  owner: 'Владелец',
  admin: 'Админ',
};

export function operationNoticeText(
  operation: LedgerOperation,
  balance: number,
): string {
  return [
    `💶 ${OPERATION_AUTHORS[operation.createdBy]}: ${signedMoney(operation)}`,
    ...(operation.note ? [escapeHtml(operation.note)] : []),
    `баланс ${formatMoney(balance)}`,
  ].join(' · ');
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
    const label = `${STATUS_META[l.status].emoji} #${l.id} ${l.brand} ${leadDisplayName(l)} — ${l.contact}`;
    return [{ text: label, callback_data: `open:${l.id}` }];
  });
  return { text: 'Найдено:', reply_markup: { inline_keyboard: rows } };
}

const STATS_OPERATION_ROWS = 20;

const ledgerDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: LEDGER_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function flowLine(label: string, { credited, debited }: FlowSums): string {
  return `${label}: +${formatMoney(credited)} · −${formatMoney(debited)}`;
}

const MAX_STATS_NOTE = 60;

function clip(text: string): string {
  return escapeHtml(
    text.length > MAX_STATS_NOTE
      ? `${text.slice(0, MAX_STATS_NOTE - 1)}…`
      : text,
  );
}

function statsOperationLine(operation: LedgerOperation): string {
  return [
    `• ${ledgerDate.format(new Date(operation.createdAt))}`,
    signedMoney(operation),
    OPERATION_AUTHORS[operation.createdBy],
    ...(operation.note ? [clip(operation.note)] : []),
  ].join(' · ');
}

export function buildStats(
  leads: StoredLead[],
  operations: LedgerOperation[],
  now: Date,
): string {
  const sums = operationSums(operations, now);
  const recent = operations
    .slice(-STATS_OPERATION_ROWS)
    .reverse()
    .map(statsOperationLine);
  const count = (s: LeadStatus) => leads.filter((l) => l.status === s).length;

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
    balanceLine('admin', balanceOf(operations)),
    flowLine('За месяц', sums.month),
    flowLine('За всё время', sums.total),
    '',
    '<b>Последние операции</b>',
    ...(recent.length ? recent : ['Операций не было.']),
  ].join('\n');
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

const DIGEST_SECTIONS: [keyof Digest, string][] = [
  ['due', '⏰ Пора вернуться'],
  ['stale', '🕐 Без движения 7 дней'],
];

const MAX_DIGEST_NAME = 40;

export const LEAD_ACTION_COPY = {
  failed: 'Ошибка, попробуйте ещё раз',
  statusUpdated: 'Статус обновлён',
  postponed: 'Отложено',
  postponedUntil: 'Отложено до ',
  resumed: 'Возобновлено',
  remindPrompt:
    '⏰ На какую дату напомнить? (ДД.ММ.ГГГГ)\n\nНапример: 20.10.2026',
  remindAck: 'Жду дату',
  badDate:
    '⚠️ Нужна дата в формате ДД.ММ.ГГГГ, не в прошлом. Попробуйте ещё раз.',
  notFound: 'Заявка не найдена.',
  deleted: '🗑 Заявка удалена.',
  deleteAck: 'Удалено',
  denied: '⛔ Доступ запрещён.',
  inWork: 'В работе ⏳',
  noteAdded: '📝 Заметка добавлена',
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

export type FieldChangeAuthor = 'owner' | 'visitor';

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

  function formatLeadText(lead: StoredLead): string {
    const contactLine = lead.contactChannel
      ? `${lead.contact} (${channelLabel(lead.contactChannel)})`
      : lead.contact;
    const lines: string[] = [
      `🚗 Заявка #${lead.id} — ${escapeHtml(servicesLabel(lead))}`,
      brandLine(lead),
      statusLine(lead.status),
    ];
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
      author: FieldChangeAuthor = 'owner',
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

    digestMessage(
      digest: Digest,
    ): { text: string; reply_markup: Keyboard } | null {
      const lines = ['<b>📋 Заявки ждут решения</b>'];
      const rows: Btn[][] = [];
      let hidden = 0;
      for (const [key, title] of DIGEST_SECTIONS) {
        const leads = digest[key];
        const shown = leads.slice(0, MAX_LIST_ROWS - rows.length);
        hidden += leads.length - shown.length;
        if (shown.length === 0) continue;
        lines.push('', `<b>${title}</b>`);
        for (const l of shown) {
          const name = leadDisplayName(l).slice(0, MAX_DIGEST_NAME);
          lines.push(
            `<a href="https://t.me/${botUsername}?start=lead_${l.id}">#${l.id}</a> ${escapeHtml(name)} · ${escapeHtml(l.brand)}`,
          );
          rows.push([
            { text: `✅ #${l.id}`, callback_data: `won:${l.id}` },
            { text: `❌ #${l.id}`, callback_data: `lost:${l.id}` },
            { text: `⏳ #${l.id}`, callback_data: `work:${l.id}` },
          ]);
        }
      }
      if (rows.length === 0) return null;
      if (hidden > 0) lines.push('', `+${hidden} ещё`);
      return {
        text: lines.join('\n'),
        reply_markup: { inline_keyboard: rows },
      };
    },

    buildHelp(role: Role): string {
      if (role === 'owner') {
        return [
          '<b>❓ Как пользоваться</b>',
          '',
          '<b>Карточка в группе</b>',
          '✅ Сделка, ❌ Отказ — итог заявки, она уходит из списков. ⏳ В работе — отметить, что занимаешься.',
          'Ответь на карточку текстом — он сохранится заметкой в заявке.',
          '',
          '<b>В боте</b>',
          '📂 Открыть в боте — вся заявка: ⏰ Отложить до даты (в этот день вернётся в открытые) и 💬 ответить посетителю через бота.',
          '',
          '<b>Меню</b>',
          'Сверху — 💶 Мой долг. ➕ Зачислить — добавить, сколько должен; ➖ Списать — убрать, что уже отправил. Бот спросит сумму: ответь 40 или 40 Иван сервис. Ошибся — исправь обратной операцией.',
          '📂 Открытые. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
        ].join('\n');
      }
      return [
        '<b>❓ Как пользоваться</b>',
        '',
        'Заявки ведёт владелец: ✅ Сделка, ❌ Отказ, ⏳ В работе на карточке в группе.',
        '',
        '<b>Меню</b>',
        'Сверху — 💶 Мне должны. ➖ Списать — когда деньги пришли, ➕ Зачислить — если владелец что-то забыл. Бот спросит сумму: ответь 40 или 40 перевод. О каждой операции владельца тебе придёт уведомление.',
        '📂 Открытые, 📊 Статистика. Найти заявку — пришли имя, телефон или номер (найдёт и отказы).',
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

      const rows: Btn[][] = [
        ...statusRows(lead, role),
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
        ...deleteRow,
      ];

      return {
        text: formatLeadText(lead),
        reply_markup: { inline_keyboard: rows },
      };
    },
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
