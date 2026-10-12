import {
  escapeHtml,
  formatMoney,
  type Btn,
  type Keyboard,
  type Role,
} from './markup.ts';
import type {
  LedgerAuthor,
  LedgerOperation,
  OperationType,
} from '../ledgerStore.ts';
import {
  MAX_OPERATION_AMOUNT,
  type OperationRefusal,
} from '../operationReply.ts';

export const LEDGER_COPY = {
  credit: '➕ Зачислить',
  debit: '➖ Списать',
  prompt: {
    payout: '➕ Сколько зачислить (в евро)?\n\nНапример: 40 или 40 Иван сервис',
    settlement: '➖ Сколько списать (в евро)?\n\nНапример: 40 или 40 перевод',
  },
  ack: 'Жду сумму',
  expired: '⌛ Этот запрос уже закрыт — нажмите ➕ или ➖ ещё раз.',
  badAmount: '⚠️ Нужна сумма числом.',
  amountLimits: `⚠️ Сумма — от 0,01 до ${formatMoney(MAX_OPERATION_AMOUNT)}, не больше двух знаков после запятой.`,
  balanceUnavailable: 'недоступен',
  unavailable:
    '⚠️ Баланс сейчас недоступен: файл учёта не читается. Админ уже знает.',
} as const;

const BALANCE_LABELS: Record<Role, string> = {
  owner: '💶 Мой долг',
  admin: '💶 Мне должны',
};

export const LEDGER_ROW: Btn[] = [
  { text: LEDGER_COPY.credit, callback_data: 'ledger:payout' },
  { text: LEDGER_COPY.debit, callback_data: 'ledger:settlement' },
];

export function balanceLine(role: Role, balance: number | undefined): string {
  const amount =
    balance === undefined
      ? LEDGER_COPY.balanceUnavailable
      : formatMoney(balance);
  return `<b>${BALANCE_LABELS[role]}: ${amount}</b>`;
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

export function signedMoney({ type, amount }: LedgerOperation): string {
  return `${type === 'payout' ? '+' : '−'}${formatMoney(amount)}`;
}

export function operationRecordedText(
  operation: LedgerOperation,
  balance: number,
): string {
  return `✅ ${signedMoney(operation)} · баланс ${formatMoney(balance)}`;
}

export function operationRefusedText(
  type: OperationType,
  balance: number,
): string {
  return `⚠️ Списать можно не больше баланса: ${formatMoney(balance)}\n\n${LEDGER_COPY.prompt[type]}`;
}

export const OPERATION_AUTHORS: Record<LedgerAuthor, string> = {
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

export function unreadableLedgerText(path: string, brand: string): string {
  return [
    `⚠️ Файл учёта ${escapeHtml(path)} не читается`,
    ``,
    `Заметил сайт ${escapeHtml(brand)}. Баланс и операции недоступны, файл не трогал — поправить можно только руками.`,
  ].join('\n');
}
