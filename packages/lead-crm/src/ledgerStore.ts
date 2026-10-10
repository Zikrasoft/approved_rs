import { z } from 'zod';
import { roundMoney, toCents } from './money.ts';
import { businessMonth, DAY_MS } from './businessTime.ts';
import type { PromptKey } from './schema.ts';
import { retryOnConflict } from './storage/retry.ts';
import { StorageConflictError, type LeadStorage } from './storage/types.ts';

export const LEDGER_PATH = 'data/ledger.json';
const MAX_OPERATION_NOTE = 500;
const PROMPT_TTL_MS = 7 * DAY_MS;
const PROMPT_KEPT_MS = 90 * DAY_MS;

const ledgerAuthorSchema = z.enum(['owner', 'admin']);
export type LedgerAuthor = z.infer<typeof ledgerAuthorSchema>;

const operationTypeSchema = z.enum(['payout', 'settlement']);
export type OperationType = z.infer<typeof operationTypeSchema>;

const operationSchema = z
  .object({
    id: z.number().int().positive(),
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

const ledgerFileSchema = z
  .object({
    operations: z.array(operationSchema),
    prompts: z.array(promptSchema),
  })
  .strict();
type LedgerFile = z.infer<typeof ledgerFileSchema>;

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
  storage: LeadStorage;
  opening?: () => Promise<OperationInput[]>;
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

const promptIs =
  ({ chatId, messageId }: PromptKey) =>
  (p: OperationPrompt) =>
    p.chatId === chatId && p.messageId === messageId;

const ageOf = (p: OperationPrompt, now: number) =>
  now - Date.parse(p.createdAt);

const isLive = (p: OperationPrompt, now: number) =>
  ageOf(p, now) < PROMPT_TTL_MS;

const liveAt = (key: PromptKey, now: number) => (p: OperationPrompt) =>
  promptIs(key)(p) && isLive(p, now);

function appended(
  file: LedgerFile,
  { type, amount, note = '', by }: OperationInput,
): { next?: LedgerFile; result: RecordOutcome } {
  const balance = balanceOf(file.operations);
  const operation = operationSchema.parse({
    id: file.operations.reduce((max, op) => Math.max(max, op.id), 0) + 1,
    type,
    amount,
    note: note.trim().slice(0, MAX_OPERATION_NOTE),
    createdAt: new Date().toISOString(),
    createdBy: by,
  });
  if (type === 'settlement' && toCents(operation.amount) > toCents(balance))
    return { result: { ok: false, reason: 'insufficient', balance } };
  const operations = [...file.operations, operation];
  return {
    next: { ...file, operations },
    result: { ok: true, operation, balance: balanceOf(operations) },
  };
}

export function createLedgerStore({ storage, opening }: LedgerStoreOptions) {
  async function openingFile(): Promise<LedgerFile> {
    let file: LedgerFile = { operations: [], prompts: [] };
    for (const input of (await opening?.()) ?? []) {
      file = appended(file, input).next ?? file;
    }
    return file;
  }

  async function read(): Promise<{
    file: LedgerFile;
    version: string | undefined;
  }> {
    const { raw, version } = await storage.read();
    if (raw === undefined) return { file: await openingFile(), version };
    const parsed = ledgerFileSchema.safeParse(raw);
    if (!parsed.success) {
      console.error('[lead-crm] the ledger file does not parse', {
        path: LEDGER_PATH,
        issues: parsed.error.issues,
      });
      throw new Error(
        '[lead-crm] the ledger file does not parse — refusing to overwrite',
      );
    }
    return { file: parsed.data, version };
  }

  function update<T>(
    mutate: (file: LedgerFile) => { next?: LedgerFile; result: T },
  ): Promise<T> {
    return retryOnConflict(async () => {
      const { file, version } = await read();
      const { next, result } = mutate(file);
      if (next) await storage.write(next, version);
      return result;
    }, 'ledger: conflict retry limit exceeded');
  }

  async function readOperations(): Promise<LedgerOperation[]> {
    return (await read()).file.operations;
  }

  async function createIfMissing(): Promise<void> {
    if (await storage.exists()) return;
    await storage
      .write(await openingFile(), undefined)
      .catch((error: unknown) => {
        if (!(error instanceof StorageConflictError)) throw error;
      });
  }

  let opened: Promise<void> | undefined;

  return {
    readOperations,

    ensureOpened(): Promise<void> {
      opened ??= createIfMissing().catch((error: unknown) => {
        opened = undefined;
        throw error;
      });
      return opened;
    },

    async readBalance(): Promise<number> {
      return balanceOf(await readOperations());
    },

    recordOperation(input: OperationInput): Promise<RecordOutcome> {
      return update((file) => appended(file, input));
    },

    openOperationPrompt(
      prompt: PromptKey & { type: OperationType },
      replacing?: PromptKey,
    ) {
      return update((file) => {
        const now = Date.now();
        const added = { ...prompt, createdAt: new Date(now).toISOString() };
        const replaced = replacing ? promptIs(replacing) : () => false;
        const fresh = file.prompts.filter(
          (p) => ageOf(p, now) < PROMPT_KEPT_MS && !replaced(p),
        );
        return {
          next: { ...file, prompts: [...fresh, added] },
          result: added,
        };
      });
    },

    async findOperationPrompt(
      key: PromptKey,
    ): Promise<FoundOperationPrompt | undefined> {
      const prompt = (await read()).file.prompts.find(promptIs(key));
      return prompt && { ...prompt, expired: !isLive(prompt, Date.now()) };
    },

    answerOperationPrompt(
      key: PromptKey,
      answer: Omit<OperationInput, 'type'>,
    ): Promise<RecordOutcome> {
      return update((file) => {
        const prompt = file.prompts.find(liveAt(key, Date.now()));
        if (!prompt)
          return { result: { ok: false, reason: 'no_prompt' } as const };
        const { next, result } = appended(file, {
          ...answer,
          type: prompt.type,
        });
        if (!next) return { result };
        const prompts = next.prompts.filter((p) => p !== prompt);
        return { next: { ...next, prompts }, result };
      });
    },
  };
}

export type LedgerStore = ReturnType<typeof createLedgerStore>;
