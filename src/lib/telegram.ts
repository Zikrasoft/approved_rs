import { SERVICE_LABELS } from '@/utils/labels';
import { isTrackedContactChannel, type TrackedContactChannel } from '@/utils/contactChannel';
import type { LeadData } from './leadTypes';

export type { LeadData };

const BOT_TOKEN = import.meta.env.TELEGRAM_BOT_TOKEN!;
const GROUP_ID = import.meta.env.TELEGRAM_GROUP_ID!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

function formatLeadText(lead: LeadData, rowUrl?: string | null): string {
  const service = SERVICE_LABELS[lead.service] ?? lead.service;
  // lead.contactChannel is a plain string at this point (from a form field
  // or the contact-click beacon, either of which could carry an arbitrary
  // value) — isTrackedContactChannel guards the lookup the same way
  // contact-click.ts's CHANNEL_COPY lookup does, not a raw `obj[input]`.
  const channelLabel = isTrackedContactChannel(lead.contactChannel) ? CONTACT_CHANNEL_LABELS[lead.contactChannel] : undefined;
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
  // Plain URL, same as Страница above — Telegram auto-linkifies it, no
  // parse_mode needed. Absent when the Sheets call failed/returned no link.
  if (rowUrl) lines.push(`Таблица: ${rowUrl}`);
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

export async function sendLeadNotification(lead: LeadData, rowUrl?: string | null): Promise<void> {
  const text = formatLeadText(lead, rowUrl);

  await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text,
  });
}
