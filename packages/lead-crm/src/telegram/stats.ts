import { BUSINESS_TIME_ZONE } from '../businessTime.ts';
import type { LeadStatus, StoredLead } from '../schema.ts';
import {
  balanceOf,
  operationSums,
  type FlowSums,
  type LedgerOperation,
} from '../ledgerStore.ts';
import { escapeHtml, formatMoney } from './markup.ts';
import { balanceLine, OPERATION_AUTHORS, signedMoney } from './ledger.ts';

const STATS_OPERATION_ROWS = 20;

const ledgerDate = new Intl.DateTimeFormat('ru-RU', {
  timeZone: BUSINESS_TIME_ZONE,
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
    `🆕 Новые: ${count('new')}   🗣 Переговоры: ${count('negotiations')}   🔵 В работе: ${count('in_progress')}   ✅ Завершено: ${count('won')}   ❌ Отказ: ${count('lost')}   ⏸ Отложено: ${count('postponed')}`,
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
