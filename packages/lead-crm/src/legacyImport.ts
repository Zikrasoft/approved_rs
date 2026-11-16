import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CrmDatabase, CrmTransaction } from './database.ts';
import { Prisma } from './generated/prisma/client.ts';
import { leadData } from './leadRow.ts';
import { legacyLedgerSchema } from './ledgerStore.ts';
import { legacyLeadSchema, type LegacyLead } from './schema.ts';

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
}

export interface ImportCounts {
  leads: number;
  digests: number;
  operations: number;
  prompts: number;
  quarantined: number;
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
      records.leads.push(lead.data);
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
  };
}

const payloadHash = (payload: unknown) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

async function importLeads(
  tx: CrmTransaction,
  leads: LegacyLead[],
): Promise<Map<number, string>> {
  const ids = new Map<number, string>();
  for (const { id: legacyId, ...lead } of leads) {
    const data = { ...leadData(lead), legacyId };
    const { id } = await tx.lead.upsert({
      where: { legacyId },
      create: data,
      update: data,
      select: { id: true },
    });
    ids.set(legacyId, id);
  }
  return ids;
}

async function importDigests(
  tx: CrmTransaction,
  digests: LegacyDigest[],
  ids: Map<number, string>,
): Promise<void> {
  for (const { day, createdAt, posted } of digests) {
    const fields = {
      createdAt: new Date(createdAt),
      messageId: posted?.messageId ?? null,
      hidden: posted?.hidden ?? null,
    };
    const digest = await tx.digest.upsert({
      where: { day: new Date(`${day}T00:00:00Z`) },
      create: { day: new Date(`${day}T00:00:00Z`), ...fields },
      update: fields,
    });
    await tx.digestLead.deleteMany({ where: { digestId: digest.id } });
    const entries = (list: 'DUE' | 'STALE', legacy: number[] = []) =>
      legacy.flatMap((legacyId, position) => {
        const leadId = ids.get(legacyId);
        return leadId ? [{ digestId: digest.id, leadId, list, position }] : [];
      });
    await tx.digestLead.createMany({
      data: [
        ...entries('DUE', posted?.dueIds),
        ...entries('STALE', posted?.staleIds),
      ],
      skipDuplicates: true,
    });
  }
}

async function importLedger(
  tx: CrmTransaction,
  { operations, prompts }: LegacyRecords['ledger'],
): Promise<void> {
  for (const {
    id: legacyId,
    type,
    amount,
    note,
    createdAt,
    createdBy,
  } of operations) {
    const data = {
      type: type === 'payout' ? 'PAYOUT' : 'SETTLEMENT',
      amount,
      note,
      createdAt: new Date(createdAt),
      createdBy: createdBy === 'owner' ? 'OWNER' : 'ADMIN',
    } as const;
    await tx.ledgerOperation.upsert({
      where: { legacyId },
      create: { ...data, legacyId },
      update: data,
    });
  }
  for (const { chatId, messageId, type, createdAt } of prompts) {
    const data = {
      type: type === 'payout' ? 'PAYOUT' : 'SETTLEMENT',
      createdAt: new Date(createdAt),
    } as const;
    await tx.operationPrompt.upsert({
      where: { chatId_messageId: { chatId: BigInt(chatId), messageId } },
      create: { chatId: BigInt(chatId), messageId, ...data },
      update: data,
    });
  }
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
