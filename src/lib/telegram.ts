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

function formatLeadText(lead: LeadData): string {
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
  if (lead.visitorId) lines.push(`ID посетителя: ${lead.visitorId}`);
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

  const sent = await tgPost('sendMessage', {
    chat_id: GROUP_ID,
    text,
  });
  const messageId = (sent as { message_id?: unknown } | null)?.message_id;
  if (typeof messageId !== 'number') {
    console.error('[telegram] sendMessage response missing message_id, skipping pin', { sent });
    return;
  }

  // No Sheets row to fall back on anymore — pinning is how staff find new
  // leads in a busy group, so a pin failure shouldn't sink the notification.
  try {
    await tgPost('pinChatMessage', {
      chat_id: GROUP_ID,
      message_id: messageId,
      disable_notification: true,
    });
  } catch (err) {
    console.error('[telegram] pinChatMessage failed', { error: err, messageId });
  }
}
