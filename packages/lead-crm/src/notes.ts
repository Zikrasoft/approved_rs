import { businessDay } from './businessTime.ts';
import { channelLabel } from './channelLabels.ts';
import { formatDateRu } from './telegram/markup.ts';

const DATED_NOTE = /^\d{2}\.\d{2}\.\d{4} · /;

export function datedNote(text: string, at = new Date()): string {
  return `${formatDateRu(businessDay(at))} · ${text}`;
}

export function isDatedNote(line: string): boolean {
  return DATED_NOTE.test(line);
}

export function visitorNote(
  text: string,
  channel: string | null | undefined,
  at = new Date(),
): string {
  const via = channel ? ` (${channelLabel(channel)})` : '';
  return datedNote(`Клиент${via}: ${text}`, at);
}

export function extraContactNote(contact: string): string {
  return `Доп. контакт: ${contact}`;
}

export function otherNameNote(name: string): string {
  return `Другое имя: ${name}`;
}
