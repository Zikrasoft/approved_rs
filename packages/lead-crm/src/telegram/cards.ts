import { channelLabel } from '../channelLabels.ts';
import { isHandleContact, isTelegramIdContact } from '../contactShape.ts';
import { LEADS_PATH } from '../quarantine.ts';
import { isInWork, type StoredLead } from '../schema.ts';
import { isPlaceholderContact, type Digest } from '../store.ts';
import {
  escapeHtml,
  formatDateRu,
  leadDisplayName,
  statusLine,
  statusMark,
  type Btn,
  type Keyboard,
  type Role,
} from './markup.ts';
import { digestMessage } from './digest.ts';
import { buildHelp } from './menu.ts';

export interface FormatterOptions {
  serviceLabel: (slug: string) => string;
  botUsername: string;
  groupId: string;
  replyRelayBrands?: readonly string[];
}

const MAX_SERVICES_LABEL = 200;
const MAX_TOPIC_NAME = 128;

export function topicLink(groupId: string, topicId: number): string {
  return `https://t.me/c/${groupId.replace(/^-100/, '')}/${topicId}`;
}

function linkedContact(contact: string): string {
  return isHandleContact(contact)
    ? `<a href="https://t.me/${escapeHtml(contact.slice(1))}">${escapeHtml(contact)}</a>`
    : escapeHtml(contact);
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
  if (!isInWork(lead) || role !== 'owner') return [];
  const talk: Btn[] =
    lead.status === 'open'
      ? [{ text: '🗣 Переговоры', callback_data: `st:${lead.id}:negotiations` }]
      : [];
  return [
    [
      { text: '✅ Сделка', callback_data: `st:${lead.id}:won` },
      { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
    ],
    [...talk, { text: '⏰ Отложить', callback_data: `postpone:${lead.id}` }],
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
  notPostponable: '⚠️ Заявку уже нельзя отложить: она больше не открыта.',
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
  groupId,
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

  function formatLeadText(
    lead: StoredLead,
    showContact: (contact: string) => string = escapeHtml,
  ): string {
    const channel = lead.contactChannel
      ? ` (${escapeHtml(channelLabel(lead.contactChannel))})`
      : '';
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
      `Контакт: ${showContact(lead.contact)}${channel}`,
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

  function topicButtons(lead: StoredLead): Btn[][] {
    return lead.topicId == null
      ? []
      : [[{ text: '💬 Открыть тему', url: topicLink(groupId, lead.topicId) }]];
  }

  return {
    formatLeadText,

    topicName(lead: StoredLead): string {
      return `#${lead.id} · ${leadDisplayName(lead)} · ${lead.brand}`.slice(
        0,
        MAX_TOPIC_NAME,
      );
    },

    topicSummaryText(lead: StoredLead): string {
      return formatLeadText(lead, linkedContact);
    },

    visitorChangeText(
      lead: StoredLead,
      field: EditField,
      before: string | null | undefined,
    ): string {
      return [
        `✏️ Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: ${EDIT_FIELD_LABELS[field]}`,
        VISITOR_CHANGE_MARK,
        ``,
        `Было: ${fieldPreview(shownValue(field, before))}`,
        `Стало: ${fieldPreview(shownValue(field, lead[field]))}`,
      ].join('\n');
    },

    formatTeaser(lead: StoredLead): string {
      return `🚗 Заявка #${lead.id} · ${escapeHtml(leadDisplayName(lead))} · ${escapeHtml(servicesLabel(lead))} · ${statusMark(lead.status)}\n${brandLine(lead)}`;
    },

    deepLinkKeyboard(lead: StoredLead): Keyboard {
      const { id } = lead;
      return {
        inline_keyboard: [
          [
            {
              text: '📂 Открыть в боте',
              url: `https://t.me/${botUsername}?start=lead_${id}`,
            },
          ],
          ...topicButtons(lead),
          [
            { text: '✅ Сделка', callback_data: `won:${id}` },
            { text: '❌ Отказ', callback_data: `lost:${id}` },
          ],
          [
            { text: '⏳ В работе', callback_data: `work:${id}` },
            { text: '🗣 Переговоры', callback_data: `talk:${id}` },
          ],
        ],
      };
    },

    digestMessage: (digest: Digest) => digestMessage(digest, botUsername),

    buildHelp,

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
        ...topicButtons(lead),
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
