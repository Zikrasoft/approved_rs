import { createHash } from 'node:crypto';
import { z } from 'zod';
import { APPROVED } from '@podbor/brands';
import type { CrmDatabase, CrmTransaction } from '../database.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { leadData } from '../leadRow.ts';
import { roundMoney } from '../money.ts';
import { isDatedNote } from '../notes.ts';
import {
  isClosed,
  LEAD_STATUSES,
  leadStatusSchema,
  storedLeadFieldsSchema,
  type LeadNote,
  type StoredLead,
} from '../schema.ts';
import { LEAD_ACTION_COPY } from '../telegram/cards.ts';
import { OPERATION_AUTHORS } from '../telegram/ledger.ts';

// TODO: delete src/legacy/, scripts/import-blob.ts and the @vercel/blob devDependency in one commit once the Vercel fallback week after the cutover ends.

export type LegacyLead = Omit<StoredLead, 'id'> & { id: number };

export const legacyLeadSchema: z.ZodType<LegacyLead, unknown> =
  storedLeadFieldsSchema
    .omit({ brand: true, status: true, telegramCard: true })
    .extend({
      id: z.number().int().positive(),
      brand: z.string().default(APPROVED.name),
      status: z.enum([...LEAD_STATUSES, 'open']).default('new'),
      archived: z.boolean().optional(),
      contactChannel: storedLeadFieldsSchema.shape.contactChannel.catch(null),
      telegramChatId: z.number().int().nullable().default(null),
      telegramMessageId: z.number().int().nullable().default(null),
    })
    .transform(
      ({ archived, status, telegramChatId, telegramMessageId, ...lead }) => {
        const current = leadStatusSchema.catch('new').parse(status);
        const advanced =
          current === 'negotiations' || current === 'in_progress';
        return {
          ...lead,
          status: archived && !isClosed({ status: current }) ? 'lost' : current,
          telegramCard:
            telegramChatId != null && telegramMessageId != null
              ? { chatId: telegramChatId, messageId: telegramMessageId }
              : null,
          lastActivityAt:
            lead.lastActivityAt ?? (advanced ? lead.statusChangedAt : null),
        };
      },
    );

const legacyOperationTypeSchema = z.enum(['payout', 'settlement']);

const legacyOperationSchema = z
  .object({
    id: z.number().int().positive(),
    type: legacyOperationTypeSchema,
    amount: z.number().transform(roundMoney).pipe(z.number().positive()),
    note: z.string().max(500),
    createdAt: z.iso.datetime(),
    createdBy: z.enum(['owner', 'admin']),
  })
  .strict();

const legacyPromptSchema = z
  .object({
    chatId: z.number().int(),
    messageId: z.number().int(),
    type: legacyOperationTypeSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

export const legacyLedgerSchema = z
  .object({
    operations: z.array(legacyOperationSchema),
    prompts: z.array(legacyPromptSchema),
  })
  .strict();

export const LEGACY_PATHS = {
  leads: 'data/leads.json',
  ledger: 'data/ledger.json',
  quarantine: 'data/leads-unreadable.json',
} as const;

const legacyDigestSchema = z.object({
  type: z.literal('digest'),
  day: z.iso.date(),
  createdAt: z.iso.datetime({ offset: true }),
  posted: z
    .object({
      messageId: z.number().int(),
      dueIds: z.array(z.number().int()),
      staleIds: z.array(z.number().int()),
      hidden: z.number().int(),
    })
    .optional(),
});
type LegacyDigest = z.infer<typeof legacyDigestSchema>;

const recordsSchema = z.array(z.unknown());

export interface LegacyBlobs {
  leads: unknown;
  ledger: unknown;
  quarantine: unknown;
}

interface Unreadable {
  source: keyof LegacyBlobs;
  payload: unknown;
}

export interface LegacyRecords {
  leads: LegacyLead[];
  digests: LegacyDigest[];
  ledger: z.infer<typeof legacyLedgerSchema>;
  unreadable: Unreadable[];
  commentsKeptWhole: number;
}

export interface ImportCounts {
  leads: number;
  digests: number;
  operations: number;
  prompts: number;
  quarantined: number;
  notes: number;
  commentsKeptWhole: number;
}

const AUTHORS = Object.entries(OPERATION_AUTHORS).map(([author, label]) => ({
  author: author as LeadNote['author'],
  label,
}));
const STAFF_NOTE = new RegExp(
  `^(\\d{2})\\.(\\d{2})\\.(\\d{4}) · (${AUTHORS.map(({ label }) => label).join('|')}): (.*)$`,
);
const POSTPONED = new RegExp(
  `^${LEAD_ACTION_COPY.postponedUntil}\\d{2}\\.\\d{2}\\.\\d{4}$`,
);

const endsANote = (line: string | undefined) =>
  line === undefined || isDatedNote(line) || POSTPONED.test(line);

function staffNote(line: string, order: number): LeadNote | undefined {
  const match = STAFF_NOTE.exec(line);
  if (!match) return undefined;
  const [, day, month, year, label, text] = match;
  const noon = Date.parse(`${year}-${month}-${day}T12:00:00Z`);
  return {
    author: AUTHORS.find((author) => author.label === label)!.author,
    text: text!,
    createdAt: new Date(noon + order).toISOString(),
  };
}

function splitNotes(lead: LegacyLead): LegacyLead | undefined {
  const lines = lead.comment?.split('\n') ?? [];
  const kept: string[] = [];
  const notes: LeadNote[] = [];
  for (const [index, line] of lines.entries()) {
    const note = staffNote(line, notes.length);
    if (!note) kept.push(line);
    else if (endsANote(lines[index + 1])) notes.push(note);
    else return undefined;
  }
  return { ...lead, comment: kept.join('\n') || null, notes };
}

const asRecords = (raw: unknown): unknown[] => {
  if (raw === undefined) return [];
  const parsed = recordsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [raw];
};

export function readLegacy({
  leads,
  ledger,
  quarantine,
}: LegacyBlobs): LegacyRecords {
  const records: LegacyRecords = {
    leads: [],
    digests: [],
    ledger: { operations: [], prompts: [] },
    unreadable: asRecords(quarantine).map((payload) => ({
      source: 'quarantine',
      payload,
    })),
    commentsKeptWhole: 0,
  };
  const withNotes = (lead: LegacyLead) => {
    const split = splitNotes(lead);
    if (split) return split;
    records.commentsKeptWhole += 1;
    return lead;
  };
  const taken = new Set<string>();
  const isFirst = (lead: LegacyLead) => {
    const keys = uniqueKeys(lead);
    if (keys.some((key) => taken.has(key))) return false;
    keys.forEach((key) => taken.add(key));
    return true;
  };
  for (const entry of asRecords(leads)) {
    const digest = legacyDigestSchema.safeParse(entry);
    const lead = legacyLeadSchema.safeParse(entry);
    if (digest.success) records.digests.push(digest.data);
    else if (lead.success && hasValidDates(lead.data) && isFirst(lead.data))
      records.leads.push(withNotes(lead.data));
    else records.unreadable.push({ source: 'leads', payload: entry });
  }
  if (ledger !== undefined) {
    const parsed = legacyLedgerSchema.safeParse(ledger);
    if (parsed.success) records.ledger = parsed.data;
    else records.unreadable.push({ source: 'ledger', payload: ledger });
  }
  return records;
}

function uniqueKeys({ id, brand, orderId, pendingPrompt }: LegacyLead) {
  return [
    `id:${id}`,
    ...(orderId ? [`order:${brand}:${orderId}`] : []),
    ...(pendingPrompt
      ? [`prompt:${pendingPrompt.chatId}:${pendingPrompt.messageId}`]
      : []),
  ];
}

function hasValidDates(lead: LegacyLead): boolean {
  return Object.values(leadData({ ...lead, id: undefined })).every(
    (value) => !(value instanceof Date) || !Number.isNaN(value.getTime()),
  );
}

export function countLegacy(records: LegacyRecords): ImportCounts {
  return {
    leads: records.leads.length,
    digests: records.digests.length,
    operations: records.ledger.operations.length,
    prompts: records.ledger.prompts.length,
    quarantined: records.unreadable.length,
    notes: records.leads.reduce((sum, lead) => sum + lead.notes.length, 0),
    commentsKeptWhole: records.commentsKeptWhole,
  };
}

const payloadHash = (payload: unknown) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

const LATE_LEAD_GAP = 1000;

async function reserveLateGap(tx: CrmTransaction): Promise<void> {
  const { _max } = await tx.lead.aggregate({ _max: { legacyId: true } });
  if (_max.legacyId == null) return;
  const target = _max.legacyId + LATE_LEAD_GAP;
  const [{ sequence }] = await tx.$queryRaw<[{ sequence: string }]>`
    SELECT pg_get_serial_sequence('leads', 'number') AS sequence`;
  const [{ next }] = await tx.$queryRawUnsafe<[{ next: bigint }]>(
    `SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END AS next FROM ${sequence}`,
  );
  if (target > Number(next))
    await tx.$executeRaw`SELECT setval(${sequence}::regclass, ${target}, false)`;
}

async function importLeads(
  tx: CrmTransaction,
  leads: LegacyLead[],
): Promise<Map<number, string>> {
  const existing = await tx.lead.findMany({
    where: { legacyId: { in: leads.map(({ id }) => id) } },
    select: { id: true, legacyId: true },
  });
  const ids = new Map(existing.map(({ id, legacyId }) => [legacyId!, id]));
  for (const { id: legacyId, ...lead } of leads) {
    if (ids.has(legacyId)) continue;
    const { id } = await tx.lead.create({
      data: {
        ...leadData(lead),
        legacyId,
        number: legacyId,
        notes: {
          create: lead.notes.map(({ author, text, createdAt }) => ({
            author,
            text,
            createdAt: new Date(createdAt),
          })),
        },
      },
      select: { id: true },
    });
    ids.set(legacyId, id);
  }
  await reserveLateGap(tx);
  return ids;
}

async function importDigests(
  tx: CrmTransaction,
  digests: LegacyDigest[],
  ids: Map<number, string>,
): Promise<void> {
  for (const { day, createdAt, posted } of digests) {
    const date = new Date(`${day}T00:00:00Z`);
    if (await tx.digest.findUnique({ where: { day: date } })) continue;
    const digest = await tx.digest.create({
      data: {
        day: date,
        createdAt: new Date(createdAt),
        messageId: posted?.messageId ?? null,
        hidden: posted?.hidden ?? null,
      },
    });
    const entries = (list: 'due' | 'stale', legacy: number[] = []) =>
      legacy.flatMap((legacyId, position) => {
        const leadId = ids.get(legacyId);
        return leadId ? [{ digestId: digest.id, leadId, list, position }] : [];
      });
    await tx.digestLead.createMany({
      data: [
        ...entries('due', posted?.dueIds),
        ...entries('stale', posted?.staleIds),
      ],
      skipDuplicates: true,
    });
  }
}

async function importLedger(
  tx: CrmTransaction,
  { operations, prompts }: LegacyRecords['ledger'],
): Promise<void> {
  await tx.ledgerOperation.createMany({
    data: operations.map(
      ({ id: legacyId, type, amount, note, createdAt, createdBy }) => ({
        legacyId,
        type,
        amount,
        note,
        createdAt: new Date(createdAt),
        createdBy,
      }),
    ),
    skipDuplicates: true,
  });
  await tx.operationPrompt.createMany({
    data: prompts.map(({ chatId, messageId, type, createdAt }) => ({
      chatId: BigInt(chatId),
      messageId,
      type,
      createdAt: new Date(createdAt),
    })),
    skipDuplicates: true,
  });
}

export async function importLegacy(
  database: CrmDatabase,
  records: LegacyRecords,
): Promise<ImportCounts> {
  await database().$transaction(
    async (tx) => {
      const ids = await importLeads(tx, records.leads);
      await importDigests(tx, records.digests, ids);
      await importLedger(tx, records.ledger);
      await tx.quarantinedRecord.createMany({
        data: records.unreadable.map(({ source, payload }) => ({
          source: LEGACY_PATHS[source],
          payloadHash: payloadHash(payload),
          payload: z.json().parse(payload) ?? Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });
    },
    { timeout: 10 * 60_000 },
  );
  return countLegacy(records);
}
