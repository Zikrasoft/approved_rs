import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crmDatabase } from './database.ts';
import {
  createLedgerStore,
  operationSums,
  type LedgerOperation,
  type LedgerStore,
  type OperationInput,
} from './ledgerStore.ts';

let ledger: LedgerStore;

const NOW = '2026-10-10T12:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const PROMPT = { chatId: 111, messageId: 7 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const credit = (amount: number, note?: string): OperationInput => ({
  type: 'payout',
  amount,
  note,
  by: 'owner',
});
const debit = (amount: number): OperationInput => ({
  type: 'settlement',
  amount,
  by: 'admin',
});

function op(
  id: string,
  overrides: Partial<LedgerOperation> = {},
): LedgerOperation {
  return {
    id,
    type: 'payout',
    amount: 10,
    note: '',
    createdAt: NOW,
    createdBy: 'owner',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  ledger = createLedgerStore({ database: crmDatabase });
});

afterEach(() => vi.useRealTimers());

describe('an empty ledger', () => {
  it('reads as no operations and a zero Balance', async () => {
    expect(await ledger.readOperations()).toEqual([]);
    expect(await ledger.readBalance()).toBe(0);
  });
});

describe('recordOperation', () => {
  it('appends a Payout and answers the new Balance', async () => {
    const outcome = await ledger.recordOperation(credit(40, '  Иван сервис '));
    expect(outcome).toEqual({
      ok: true,
      operation: {
        id: expect.stringMatching(UUID),
        type: 'payout',
        amount: 40,
        note: 'Иван сервис',
        createdAt: NOW,
        createdBy: 'owner',
      },
      balance: 40,
    });
    expect(await ledger.readOperations()).toEqual([
      (outcome as { operation: LedgerOperation }).operation,
    ]);
  });

  it('stores an empty note when none is given and keeps operations in order', async () => {
    await ledger.recordOperation(credit(40));
    vi.setSystemTime(Date.parse(NOW) + 1000);
    await ledger.recordOperation(credit(0.1));
    vi.setSystemTime(Date.parse(NOW) + 2000);
    await ledger.recordOperation(credit(0.2));
    const operations = await ledger.readOperations();
    expect(operations.map((o) => [o.amount, o.note])).toEqual([
      [40, ''],
      [0.1, ''],
      [0.2, ''],
    ]);
    expect(await ledger.readBalance()).toBe(40.3);
  });

  it('lowers the Balance with a Settlement, down to exactly zero', async () => {
    await ledger.recordOperation(credit(0.1));
    await ledger.recordOperation(credit(0.2));
    const outcome = await ledger.recordOperation(debit(0.3));
    expect(outcome).toMatchObject({
      ok: true,
      balance: 0,
      operation: { type: 'settlement', amount: 0.3, createdBy: 'admin' },
    });
  });

  it('refuses a Settlement above the Balance and writes nothing', async () => {
    await ledger.recordOperation(credit(30));
    expect(await ledger.recordOperation(debit(30.01))).toEqual({
      ok: false,
      reason: 'insufficient',
      balance: 30,
    });
    expect(await ledger.readOperations()).toHaveLength(1);
    expect(await ledger.readBalance()).toBe(30);
  });

  it('rounds the amount to cents and refuses one that rounds to nothing', async () => {
    const outcome = await ledger.recordOperation(credit(12.345));
    expect(outcome).toMatchObject({ operation: { amount: 12.35 } });
    await expect(ledger.recordOperation(credit(0.001))).rejects.toThrow();
  });

  it('checks the Balance inside the write, against what another writer stored first', async () => {
    await ledger.recordOperation(credit(50));
    const outcomes = await Promise.all([
      ledger.recordOperation(debit(50)),
      ledger.recordOperation(debit(50)),
    ]);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok)).toEqual([
      { ok: false, reason: 'insufficient', balance: 0 },
    ]);
    expect(await ledger.readOperations()).toHaveLength(2);
    expect(await ledger.readBalance()).toBe(0);
  });

  it('loses neither of two concurrent writers', async () => {
    await Promise.all([
      ledger.recordOperation(credit(10)),
      ledger.recordOperation({ ...credit(20), by: 'admin' }),
    ]);
    expect((await ledger.readOperations()).map((o) => o.amount).sort()).toEqual(
      [10, 20],
    );
    expect(await ledger.readBalance()).toBe(30);
  });
});

describe('operation prompts', () => {
  it('records the answer as the operation the prompt asked for, once', async () => {
    await ledger.recordOperation(credit(50));
    await ledger.openOperationPrompt({ ...PROMPT, type: 'settlement' });
    expect(await ledger.findOperationPrompt(PROMPT)).toEqual({
      ...PROMPT,
      type: 'settlement',
      createdAt: NOW,
      expired: false,
    });
    const answer = { amount: 20, note: 'перевод', by: 'owner' as const };
    expect(await ledger.answerOperationPrompt(PROMPT, answer)).toMatchObject({
      ok: true,
      balance: 30,
      operation: { type: 'settlement', note: 'перевод', createdBy: 'owner' },
    });
    expect(await ledger.findOperationPrompt(PROMPT)).toBeUndefined();
    expect(await ledger.answerOperationPrompt(PROMPT, answer)).toEqual({
      ok: false,
      reason: 'no_prompt',
    });
    expect(await ledger.readBalance()).toBe(30);
  });

  it('keeps the prompt open when the debit is refused', async () => {
    await ledger.openOperationPrompt({ ...PROMPT, type: 'settlement' });
    expect(
      await ledger.answerOperationPrompt(PROMPT, { amount: 1, by: 'admin' }),
    ).toEqual({ ok: false, reason: 'insufficient', balance: 0 });
    expect(await ledger.findOperationPrompt(PROMPT)).toBeDefined();
  });

  it('closes the prompt it replaces in the same write', async () => {
    await ledger.openOperationPrompt({ ...PROMPT, type: 'payout' });
    const other = { ...PROMPT, messageId: 9 };
    await ledger.openOperationPrompt({ ...other, type: 'payout' });

    await ledger.openOperationPrompt(
      { ...PROMPT, messageId: 8, type: 'payout' },
      PROMPT,
    );

    expect(await ledger.findOperationPrompt(PROMPT)).toBeUndefined();
    expect(await ledger.findOperationPrompt(other)).toBeDefined();
    expect(
      await ledger.findOperationPrompt({ ...PROMPT, messageId: 8 }),
    ).toBeDefined();
  });

  it('tells prompts apart by chat and message', async () => {
    await ledger.openOperationPrompt({ ...PROMPT, type: 'payout' });
    expect(
      await ledger.findOperationPrompt({ ...PROMPT, chatId: 222 }),
    ).toBeUndefined();
    expect(
      await ledger.findOperationPrompt({ ...PROMPT, messageId: 8 }),
    ).toBeUndefined();
  });

  it('finds a prompt older than a week as expired and takes no answer to it', async () => {
    await ledger.recordOperation(credit(50));
    await ledger.openOperationPrompt({ ...PROMPT, type: 'settlement' });
    vi.setSystemTime(Date.parse(NOW) + 7 * DAY);
    expect(await ledger.findOperationPrompt(PROMPT)).toMatchObject({
      expired: true,
    });
    expect(
      await ledger.answerOperationPrompt(PROMPT, { amount: 5, by: 'owner' }),
    ).toEqual({ ok: false, reason: 'no_prompt' });
    expect(await ledger.findOperationPrompt(PROMPT)).toMatchObject({
      expired: true,
    });
    expect(await ledger.readBalance()).toBe(50);
  });

  it('keeps an expired prompt when a new one opens, and drops it after 90 days', async () => {
    await ledger.openOperationPrompt({ ...PROMPT, type: 'payout' });
    vi.setSystemTime(Date.parse(NOW) + 89 * DAY);
    await ledger.openOperationPrompt({
      ...PROMPT,
      messageId: 8,
      type: 'payout',
    });
    expect(await ledger.findOperationPrompt(PROMPT)).toMatchObject({
      expired: true,
    });
    vi.setSystemTime(Date.parse(NOW) + 90 * DAY + 1);
    await ledger.openOperationPrompt({
      ...PROMPT,
      messageId: 9,
      type: 'payout',
    });
    expect(await ledger.findOperationPrompt(PROMPT)).toBeUndefined();
    expect(
      await ledger.findOperationPrompt({ ...PROMPT, messageId: 8 }),
    ).toBeDefined();
    expect(
      await ledger.findOperationPrompt({ ...PROMPT, messageId: 9 }),
    ).toBeDefined();
  });
});

describe('operationSums', () => {
  it('sums credits and debits for the Belgrade month and for all time', () => {
    const operations = [
      op('1', { amount: 100, createdAt: '2026-09-30T21:59:00.000Z' }),
      op('2', { amount: 40, createdAt: '2026-09-30T22:00:00.000Z' }),
      op('3', {
        type: 'settlement',
        amount: 0.1,
        createdAt: '2026-10-09T10:00:00.000Z',
      }),
      op('4', {
        type: 'settlement',
        amount: 0.2,
        createdAt: '2026-10-09T11:00:00.000Z',
      }),
      op('5', {
        type: 'settlement',
        amount: 50,
        createdAt: '2026-09-15T11:00:00.000Z',
      }),
    ];
    expect(operationSums(operations, new Date(NOW))).toEqual({
      month: { credited: 40, debited: 0.3 },
      total: { credited: 140, debited: 50.3 },
    });
  });
});
