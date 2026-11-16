import { z } from 'zod';
import { roundMoney, toCents } from './money.ts';
import { businessMonth, DAY_MS } from './businessTime.ts';
import type { PromptKey } from './promptKey.ts';
import { lockKey, type CrmDatabase, type CrmTransaction } from './database.ts';
import type {
  LedgerOperation as OperationRow,
  OperationPrompt as PromptRow,
} from './generated/prisma/client.ts';

const MAX_OPERATION_NOTE = 500;
const PROMPT_TTL_MS = 7 * DAY_MS;
const PROMPT_KEPT_MS = 90 * DAY_MS;

const ledgerAuthorSchema = z.enum(['owner', 'admin']);
export type LedgerAuthor = z.infer<typeof ledgerAuthorSchema>;

const operationTypeSchema = z.enum(['payout', 'settlement']);
export type OperationType = z.infer<typeof operationTypeSchema>;

const operationSchema = z
  .object({
    id: z.string(),
    type: operationTypeSchema,
    amount: z.number().transform(roundMoney).pipe(z.number().positive()),
    note: z.string().max(MAX_OPERATION_NOTE),
    createdAt: z.iso.datetime(),
    createdBy: ledgerAuthorSchema,
  })
  .strict();
export type LedgerOperation = z.infer<typeof operationSchema>;

const promptSchema = z
  .object({
    chatId: z.number().int(),
    messageId: z.number().int(),
    type: operationTypeSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();
export type OperationPrompt = z.infer<typeof promptSchema>;
export type FoundOperationPrompt = OperationPrompt & { expired: boolean };

export const legacyLedgerSchema = z
  .object({
    operations: z.array(
      operationSchema.extend({ id: z.number().int().positive() }),
    ),
    prompts: z.array(promptSchema),
  })
  .strict();

const newOperationSchema = operationSchema.omit({ id: true, createdAt: true });

export interface OperationInput {
  type: OperationType;
  amount: number;
  note?: string;
  by: LedgerAuthor;
}

export type RecordOutcome =
  | { ok: true; operation: LedgerOperation; balance: number }
  | { ok: false; reason: 'insufficient'; balance: number }
  | { ok: false; reason: 'no_prompt' };

export interface LedgerStoreOptions {
  database: CrmDatabase;
}

export interface FlowSums {
  credited: number;
  debited: number;
}

function centsOf(operations: LedgerOperation[], type: OperationType): number {
  return operations
    .filter((op) => op.type === type)
    .reduce((cents, op) => cents + toCents(op.amount), 0);
}

function sumsOf(operations: LedgerOperation[]): FlowSums {
  return {
    credited: centsOf(operations, 'payout') / 100,
    debited: centsOf(operations, 'settlement') / 100,
  };
}

export function balanceOf(operations: LedgerOperation[]): number {
  return (
    (centsOf(operations, 'payout') - centsOf(operations, 'settlement')) / 100
  );
}

export function operationSums(
  operations: LedgerOperation[],
  now: Date,
): { month: FlowSums; total: FlowSums } {
  const month = businessMonth(now);
  return {
    month: sumsOf(
      operations.filter(
        (op) => businessMonth(new Date(op.createdAt)) === month,
      ),
    ),
    total: sumsOf(operations),
  };
}

const upper = <T extends string>(value: T) =>
  value.toUpperCase() as Uppercase<T>;
const lower = <T extends string>(value: T) =>
  value.toLowerCase() as Lowercase<T>;

const toOperation = (row: OperationRow): LedgerOperation => ({
  id: row.id,
  type: lower(row.type),
  amount: row.amount.toNumber(),
  note: row.note,
  createdAt: row.createdAt.toISOString(),
  createdBy: lower(row.createdBy),
});

const toPrompt = (row: PromptRow): OperationPrompt => ({
  chatId: Number(row.chatId),
  messageId: row.messageId,
  type: lower(row.type),
  createdAt: row.createdAt.toISOString(),
});

const promptKey = ({ chatId, messageId }: PromptKey) => ({
  chatId_messageId: { chatId: BigInt(chatId), messageId },
});

const isLive = (p: OperationPrompt, now: number) =>
  now - Date.parse(p.createdAt) < PROMPT_TTL_MS;

const LEDGER_LOCK = 'crm.ledger';

export function createLedgerStore({ database }: LedgerStoreOptions) {
  async function readOperations(
    client: CrmTransaction = database(),
  ): Promise<LedgerOperation[]> {
    const rows = await client.ledgerOperation.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toOperation);
  }

  async function append(
    tx: CrmTransaction,
    { type, amount, note = '', by }: OperationInput,
  ): Promise<RecordOutcome> {
    await lockKey(tx, LEDGER_LOCK);
    const balance = balanceOf(await readOperations(tx));
    const input = newOperationSchema.parse({
      type,
      amount,
      note: note.trim().slice(0, MAX_OPERATION_NOTE),
      createdBy: by,
    });
    if (type === 'settlement' && toCents(input.amount) > toCents(balance))
      return { ok: false, reason: 'insufficient', balance };
    const operation = toOperation(
      await tx.ledgerOperation.create({
        data: {
          type: upper(input.type),
          amount: input.amount,
          note: input.note,
          createdBy: upper(input.createdBy),
          createdAt: new Date(),
        },
      }),
    );
    return {
      ok: true,
      operation,
      balance: balanceOf(await readOperations(tx)),
    };
  }

  return {
    readOperations: () => readOperations(),

    async readBalance(): Promise<number> {
      return balanceOf(await readOperations());
    },

    recordOperation(input: OperationInput): Promise<RecordOutcome> {
      return database().$transaction((tx) => append(tx, input));
    },

    openOperationPrompt(
      prompt: PromptKey & { type: OperationType },
      replacing?: PromptKey,
    ): Promise<OperationPrompt> {
      return database().$transaction(async (tx) => {
        const createdAt = new Date();
        await tx.operationPrompt.deleteMany({
          where: {
            OR: [
              {
                createdAt: {
                  lte: new Date(createdAt.getTime() - PROMPT_KEPT_MS),
                },
              },
              ...(replacing ? [promptKey(replacing).chatId_messageId] : []),
            ],
          },
        });
        const fields = { type: upper(prompt.type), createdAt };
        return toPrompt(
          await tx.operationPrompt.upsert({
            where: promptKey(prompt),
            create: { ...promptKey(prompt).chatId_messageId, ...fields },
            update: fields,
          }),
        );
      });
    },

    async findOperationPrompt(
      key: PromptKey,
    ): Promise<FoundOperationPrompt | undefined> {
      const row = await database().operationPrompt.findUnique({
        where: promptKey(key),
      });
      if (!row) return undefined;
      const prompt = toPrompt(row);
      return { ...prompt, expired: !isLive(prompt, Date.now()) };
    },

    answerOperationPrompt(
      key: PromptKey,
      answer: Omit<OperationInput, 'type'>,
    ): Promise<RecordOutcome> {
      return database().$transaction(async (tx) => {
        await lockKey(tx, LEDGER_LOCK);
        const row = await tx.operationPrompt.findUnique({
          where: promptKey(key),
        });
        const prompt = row && toPrompt(row);
        if (!prompt || !isLive(prompt, Date.now()))
          return { ok: false, reason: 'no_prompt' } as const;
        const result = await append(tx, { ...answer, type: prompt.type });
        if (result.ok)
          await tx.operationPrompt.delete({ where: promptKey(key) });
        return result;
      });
    },
  };
}

export type LedgerStore = ReturnType<typeof createLedgerStore>;
