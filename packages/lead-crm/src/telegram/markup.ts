import { format, parseISO } from 'date-fns';
import type { LeadStatus } from '../schema.ts';

export type Role = 'owner' | 'admin';

export type Btn = { text: string } & (
  | { callback_data: string; url?: never }
  | { url: string; callback_data?: never }
);
export type Keyboard = { inline_keyboard: Btn[][] };

export const leadDisplayName = (lead: { name: string }): string =>
  lead.name || '—';

export const STATUS_META: Record<LeadStatus, { emoji: string; label: string }> =
  {
    new: { emoji: '🆕', label: 'Новая' },
    negotiations: { emoji: '🗣', label: 'Переговоры' },
    in_progress: { emoji: '🔵', label: 'В работе' },
    won: { emoji: '✅', label: 'Успешно' },
    lost: { emoji: '❌', label: 'Отказ' },
    postponed: { emoji: '⏸️', label: 'Отложена' },
  };

export function statusMark(status: LeadStatus): string {
  const { emoji, label } = STATUS_META[status];
  return `${emoji} ${label}`;
}

export function statusLine(status: LeadStatus): string {
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
