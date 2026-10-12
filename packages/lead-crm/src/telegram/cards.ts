import { channelLabel } from '../channelLabels.ts';
import { isHandleContact } from '../contactShape.ts';
import { LEADS_PATH } from '../quarantine.ts';
import { isClosed, isInWork, type StoredLead } from '../schema.ts';
import { isPlaceholderContact, type Digest } from '../store.ts';
import { businessDay } from '../businessTime.ts';
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
import { digestMessage, redrawDigest } from './digest.ts';
import { OPERATION_AUTHORS } from './ledger.ts';
import { buildHelp } from './menu.ts';

export interface FormatterOptions {
  serviceLabel: (slug: string) => string;
  botUsername: string;
  groupId: string;
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

const IN_WORK_MOVES = [
  { status: 'negotiations', text: '🗣 Переговоры' },
  { status: 'in_progress', text: '🔵 В работе' },
] as const;

function statusRows(lead: StoredLead): Btn[][] {
  if (lead.status === 'postponed')
    return [[{ text: '▶️ Возобновить', callback_data: `resume:${lead.id}` }]];
  if (!isInWork(lead)) return [];
  const moves = IN_WORK_MOVES.filter((m) => m.status !== lead.status).map(
    (m) => ({ text: m.text, callback_data: `st:${lead.id}:${m.status}` }),
  );
  return [
    [
      { text: '✅ Сделка', callback_data: `st:${lead.id}:won` },
      { text: '❌ Отказ', callback_data: `st:${lead.id}:lost` },
    ],
    [...moves, { text: '⏰ Отложить', callback_data: `postpone:${lead.id}` }],
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
} as const;

export type EditField = keyof typeof EDIT_FIELD_LABELS;

const EDIT_PROMPTS: Record<EditField, string> = {
  name: '✏️ Введите новое значение (имя):',
  contact:
    '➕ Пришлите контакт: телефон, @username, ссылку или e-mail. Если контакт уже есть, новый добавится в заметки.',
};

export const EDIT_COPY = {
  prompt: (field: EditField) => EDIT_PROMPTS[field],
  ack: 'Жду значение',
  empty: '⚠️ Значение не может быть пустым.',
  badContact: '⚠️ Нужен телефон, @username, ссылка или e-mail.',
  updated: '✅ Обновлено',
  contactNoted: '📝 Контакт добавлен в заметки — основной не меняется',
  notePrompt: '📝 Напишите заметку:',
  noteAck: 'Жду заметку',
} as const;

export function reAskEditText(field: EditField | 'note'): string {
  const refusal = field === 'contact' ? EDIT_COPY.badContact : EDIT_COPY.empty;
  const prompt =
    field === 'note' ? EDIT_COPY.notePrompt : EDIT_COPY.prompt(field);
  return `${refusal}\n\n${prompt}`;
}

export function noteLine(text: string, by: Role, at = new Date()): string {
  return `${formatDateRu(businessDay(at))} · ${OPERATION_AUTHORS[by]}: ${text}`;
}

export function extraContactNote(contact: string): string {
  return `Доп. контакт: ${contact}`;
}

export function noteNoticeText(
  lead: StoredLead,
  note: string,
  by: Role,
): string {
  return `📝 Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))} · ${OPERATION_AUTHORS[by]}: ${escapeHtml(note)}`;
}

const FIELD_PREVIEW_LIMIT = 120;

function fieldPreview(value: string): string {
  const text = value.trim();
  if (!text) return '—';
  return escapeHtml(
    text.length <= FIELD_PREVIEW_LIMIT
      ? text
      : `${text.slice(0, FIELD_PREVIEW_LIMIT)}…`,
  );
}

export function fieldChangeText(
  lead: StoredLead,
  field: EditField,
  before: string,
  by: Role,
): string {
  return [
    `✏️ Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: ${EDIT_FIELD_LABELS[field]}`,
    `✍️ ${OPERATION_AUTHORS[by]}`,
    ``,
    `Было: ${fieldPreview(before)}`,
    `Стало: ${fieldPreview(lead[field])}`,
  ].join('\n');
}

function editRows({ id }: StoredLead): Btn[][] {
  return [
    [
      { text: '✏️ Имя', callback_data: `edit:${id}:name` },
      { text: '➕ Контакт', callback_data: `edit:${id}:contact` },
    ],
    [{ text: '📝 Заметка', callback_data: `note:${id}` }],
  ];
}

export const REPLY_COPY = {
  undelivered:
    '⚠️ Не доставлено: посетитель заблокировал бота или чат недоступен.',
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
  closed: '⚠️ Заявка уже закрыта.',
  deleted: '🗑 Заявка удалена.',
  deleteAck: 'Удалено',
  denied: '⛔ Доступ запрещён.',
  roleOnly: {
    owner: 'Это действие доступно владельцу',
    admin: 'Это действие доступно админу',
  } satisfies Record<Role, string>,
  inWork: 'В работе 🔵',
  noteAdded: '📝 Заметка добавлена',
  topicOpened: '💬 Тема открыта',
  topicFailed:
    '⚠️ Тему открыть не удалось: включите темы в группе и дайте боту право «Управление темами».',
} as const;

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

export function managerHandoffText(handle: string): string {
  return `👤 Ушёл к менеджеру @${escapeHtml(handle)}`;
}

function handoffLine(lead: StoredLead): string {
  return lead.managerHandoff
    ? `\n${managerHandoffText(lead.managerHandoff.handle)} · ${formatDateRu(lead.managerHandoff.at)}`
    : '';
}

const AD_SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  fb: 'Facebook',
  instagram: 'Instagram',
  ig: 'Instagram',
  google: 'Google',
};

const AD_HASHTAG = '#реклама';

function adLine({ adSource }: StoredLead): string {
  if (!adSource) return '';
  const { source, campaign, content } = adSource;
  const parts = [
    source && (AD_SOURCE_LABELS[source.toLowerCase()] ?? source),
    campaign,
    content,
  ].filter(Boolean);
  return parts.length
    ? `\n📣 Реклама: ${escapeHtml(parts.join(' · '))}`
    : '\n📣 Реклама';
}

function adHashtag(lead: StoredLead, separator: string): string {
  return lead.adSource ? `${separator}${AD_HASHTAG}` : '';
}

function remindLine(lead: StoredLead): string {
  return lead.status === 'postponed' && lead.remindAt
    ? `\n⏰ Напомнить: ${formatDateRu(lead.remindAt)}`
    : '';
}

export function statusChangeText(lead: StoredLead, by: Role): string {
  return `🔔 Заявка #${lead.id} ${escapeHtml(leadDisplayName(lead))}: статус — ${statusMark(lead.status)}\n✍️ ${OPERATION_AUTHORS[by]}`;
}

export function createFormatter({
  serviceLabel,
  botUsername,
  groupId,
}: FormatterOptions) {
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
    return `🏷 ${escapeHtml(lead.brand)}${via}${referred}${adLine(lead)}${handoffLine(lead)}`;
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
    const remind = remindLine(lead);
    if (remind) lines.push(remind.trim());
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
    lines.push(``, `#заявка${adHashtag(lead, ' ')}`);
    return lines.join('\n');
  }

  function topicButtons(lead: StoredLead): Btn[][] {
    if (lead.topicId != null)
      return [
        [{ text: '💬 Открыть тему', url: topicLink(groupId, lead.topicId) }],
      ];
    if (lead.telegramId != null)
      return [
        [{ text: '💬 Начать переписку', callback_data: `topic:${lead.id}` }],
      ];
    return [];
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

    formatTeaser(lead: StoredLead): string {
      return `🚗 Заявка #${lead.id} · ${escapeHtml(leadDisplayName(lead))} · ${escapeHtml(servicesLabel(lead))} · ${statusMark(lead.status)}${remindLine(lead)}\n${brandLine(lead)}${adHashtag(lead, '\n')}`;
    },

    postponeReminderText(lead: StoredLead): string {
      return [
        `⏰ Напоминание по заявке #${lead.id}`,
        ``,
        `${escapeHtml(leadDisplayName(lead))} — ${escapeHtml(servicesLabel(lead))}`,
        `Ты просил напомнить сегодня — заявка снова активна.`,
      ].join('\n');
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
          ...(isClosed(lead)
            ? []
            : [
                [
                  { text: '🗣 Переговоры', callback_data: `talk:${id}` },
                  { text: '🔵 В работе', callback_data: `work:${id}` },
                  { text: '⏰ Отложить', callback_data: `postpone:${id}` },
                ],
              ]),
        ],
      };
    },

    digestMessage: (digest: Digest) => digestMessage(digest, botUsername),

    redrawDigest: (message: unknown, leads: StoredLead[], actedOn: number) =>
      redrawDigest(message, leads, actedOn, botUsername),

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
        ...statusRows(lead),
        ...editRows(lead),
        ...topicButtons(lead),
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
