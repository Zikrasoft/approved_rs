import { SERVICE_LABELS, STATUS_LABELS } from '@/utils/labels';

const BOT_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = import.meta.env.TELEGRAM_GROUP_ID!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Telegram/phone tab both submit a plain contact string (handle or number);
// contactChannel says which app the visitor actually wants to be reached on
// — WhatsApp/Viber/phone share the same phone-number input in the form, so
// without this staff would have to guess which app to open.
const CONTACT_CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  phone: 'звонок',
};

export interface LeadData {
  id: number;
  name: string;
  contact: string;
  service: string;
  contactChannel?: string | null;
  comment?: string | null;
  country?: string | null;
  source_url?: string | null;
}

function formatLeadText(lead: LeadData): string {
  const service = SERVICE_LABELS[lead.service] ?? lead.service;
  const channelLabel = lead.contactChannel ? CONTACT_CHANNEL_LABELS[lead.contactChannel] : undefined;
  const contactLine = channelLabel ? `${lead.contact} (${channelLabel})` : lead.contact;
  const lines: string[] = [
    `🚗 Заявка #${lead.id} — ${service}`,
    ``,
    `Имя: ${lead.name}`,
    `Контакт: ${contactLine}`,
  ];
  if (lead.country) lines.push(`Страна: ${lead.country.toUpperCase()}`);
  if (lead.comment) lines.push(`Комментарий: ${lead.comment}`);
  if (lead.source_url) lines.push(`Страница: ${lead.source_url}`);
  lines.push(``, `#заявка`);
  return lines.join('\n');
}

async function tgPost(method: string, body: object): Promise<unknown> {
  const response = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Telegram ${method} failed: ${response.status}`);
  }
  const data = await response.json() as { result: unknown };
  return data.result;
}

export async function sendLeadNotification(lead: LeadData): Promise<void> {
  const text = formatLeadText(lead);

  await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ В работу', callback_data: `accept:${lead.id}` },
        { text: '❌ Закрыт',  callback_data: `close:${lead.id}` },
        { text: '🚫 Спам',   callback_data: `spam:${lead.id}` },
      ]],
    },
  });
}

export async function editGroupMessage(
  messageId: number,
  originalText: string,
  handledBy: string,
  status: string
): Promise<void> {
  const label = STATUS_LABELS[status] ?? status;
  await tgPost('editMessageText', {
    chat_id: GROUP_ID,
    message_id: messageId,
    text: `${originalText}\n\n${label} — @${handledBy}`,
    reply_markup: { inline_keyboard: [] },
  });
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  await tgPost('answerCallbackQuery', { callback_query_id: callbackQueryId });
}
