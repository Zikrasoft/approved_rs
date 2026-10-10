import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMemoryStorage,
  type MemoryStorage,
} from './storage/memory.testing.ts';
import { StorageConflictError } from './storage/types.ts';
import {
  createLedgerStore,
  operationSums,
  type LedgerOperation,
  type LedgerStore,
  type OperationInput,
} from './ledgerStore.ts';

let storage: MemoryStorage;
let ledger: LedgerStore;

const NOW = '2026-10-10T12:00:00.000Z';
const PROMPT = { chatId: 111, messageId: 7 };

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
  id: number,
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

function file() {
  return storage.current() as {
    operations: LedgerOperation[];
    prompts: unknown[];
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  storage = createMemoryStorage();
  ledger = createLedgerStore({ storage });
});

afterEach(() => vi.useRealTimers());

describe('an empty ledger', () => {
  it('reads as no operations and a zero Balance without writing', async () => {
    expect(await ledger.readOperations()).toEqual([]);
    expect(await ledger.readBalance()).toBe(0);
    expect(storage.writeAttempts()).toBe(0);
  });
});

describe('recordOperation', () => {
  it('appends a Payout to its own file and answers the new Balance', async () => {
    const outcome = await ledger.recordOperation(credit(40, '  Иван сервис '));
    const stored = op(1, { amount: 40, note: 'Иван сервис' });
    expect(outcome).toEqual({ ok: true, operation: stored, balance: 40 });
    expect(file()).toEqual({ operations: [stored], prompts: [] });
  });

  it('stores an empty note when none is given and numbers operations in order', async () => {
    await ledger.recordOperation(credit(40));
    await ledger.recordOperation(credit(0.1));
    await ledger.recordOperation(credit(0.2));
    const operations = await ledger.readOperations();
    expect(operations.map((o) => [o.id, o.note])).toEqual([
      [1, ''],
      [2, ''],
      [3, ''],
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
    const writes = storage.writeAttempts();
    expect(await ledger.recordOperation(debit(30.01))).toEqual({
      ok: false,
      reason: 'insufficient',
      balance: 30,
    });
    expect(storage.writeAttempts()).toBe(writes);
    expect(await ledger.readBalance()).toBe(30);
  });

  it('rounds the amount to cents and refuses one that rounds to nothing', async () => {
    const outcome = await ledger.recordOperation(credit(12.345));
    expect(outcome).toMatchObject({ operation: { amount: 12.35 } });
    await expect(ledger.recordOperation(credit(0.001))).rejects.toThrow();
  });

  it('checks the Balance inside the write, against what another writer stored first', async () => {
    await ledger.recordOperation(credit(50));
    const before = file();
    storage.failNextWrites(1, () =>
      storage.seed({
        ...before,
        operations: [
          ...before.operations,
          op(2, { type: 'settlement', amount: 50 }),
        ],
      }),
    );
    expect(await ledger.recordOperation(debit(50))).toEqual({
      ok: false,
      reason: 'insufficient',
      balance: 0,
    });
    expect(file().operations).toHaveLength(2);
  });

  it('loses neither of two concurrent writers', async () => {
    storage.seed({ operations: [], prompts: [] });
    await Promise.all([
      ledger.recordOperation(credit(10)),
      ledger.recordOperation({ ...credit(20), by: 'admin' }),
    ]);
    expect(
      file()
        .operations.map((o) => [o.id, o.amount])
        .sort(),
    ).toEqual([
      [1, 10],
      [2, 20],
    ]);
    expect(await ledger.readBalance()).toBe(30);
  });

  it('gives up after repeated conflicts', async () => {
    storage.failNextWrites(6);
    const error = await ledger.recordOperation(credit(10)).catch((e) => e);
    expect(error).toBeInstanceOf(StorageConflictError);
    expect(error.message).toBe('ledger: conflict retry limit exceeded');
    expect(error.cause).toBeInstanceOf(StorageConflictError);
    expect(storage.writeAttempts()).toBe(6);
  });

  it('does not retry an error that is not a conflict', async () => {
    const broken = createLedgerStore({
      storage: {
        read: () => Promise.resolve({ raw: undefined, version: undefined }),
        write: () => Promise.reject(new Error('blob down')),
      },
    });
    await expect(broken.recordOperation(credit(10))).rejects.toThrow(
      'blob down',
    );
  });

  it('refuses to overwrite a file it cannot parse', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.seed([{ type: 'payout' }]);
    await expect(ledger.recordOperation(credit(10))).rejects.toThrow(
      'refusing to overwrite',
    );
    expect(storage.current()).toEqual([{ type: 'payout' }]);
  });
});

describe('the opening operations', () => {
  it('open a ledger that does not exist yet, once', async () => {
    const opening = vi.fn(() =>
      Promise.resolve([{ ...credit(25, 'Перенос'), by: 'admin' as const }]),
    );
    ledger = createLedgerStore({ storage, opening });
    expect(await ledger.readBalance()).toBe(25);
    await ledger.recordOperation(credit(5));
    expect(file().operations).toEqual([
      op(1, { amount: 25, note: 'Перенос', createdBy: 'admin' }),
      op(2, { amount: 5 }),
    ]);
    opening.mockClear();
    expect(await ledger.readBalance()).toBe(30);
    expect(opening).not.toHaveBeenCalled();
  });

  it('skip an opening debit the Balance cannot cover', async () => {
    ledger = createLedgerStore({
      storage,
      opening: () => Promise.resolve([debit(5)]),
    });
    expect(await ledger.readOperations()).toEqual([]);
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

  it('treats a prompt older than a week as gone', async () => {
    await ledger.recordOperation(credit(50));
    await ledger.openOperationPrompt({ ...PROMPT, type: 'settlement' });
    vi.setSystemTime(Date.parse(NOW) + 7 * 24 * 60 * 60 * 1000);
    expect(await ledger.findOperationPrompt(PROMPT)).toBeUndefined();
    expect(
      await ledger.answerOperationPrompt(PROMPT, { amount: 5, by: 'owner' }),
    ).toEqual({ ok: false, reason: 'no_prompt' });
    expect(await ledger.readBalance()).toBe(50);
  });

  it('drops prompts older than a week when a new one opens', async () => {
    await ledger.openOperationPrompt({ ...PROMPT, type: 'payout' });
    vi.setSystemTime(new Date('2026-10-17T12:00:00.000Z'));
    await ledger.openOperationPrompt({
      ...PROMPT,
      messageId: 8,
      type: 'payout',
    });
    expect(file().prompts).toEqual([
      {
        ...PROMPT,
        messageId: 8,
        type: 'payout',
        createdAt: '2026-10-17T12:00:00.000Z',
      },
    ]);
  });
});

describe('operationSums', () => {
  it('sums credits and debits for the Belgrade month and for all time', () => {
    const operations = [
      op(1, { amount: 100, createdAt: '2026-09-30T21:59:00.000Z' }),
      op(2, { amount: 40, createdAt: '2026-09-30T22:00:00.000Z' }),
      op(3, {
        type: 'settlement',
        amount: 0.1,
        createdAt: '2026-10-09T10:00:00.000Z',
      }),
      op(4, {
        type: 'settlement',
        amount: 0.2,
        createdAt: '2026-10-09T11:00:00.000Z',
      }),
      op(5, {
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
