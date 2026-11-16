import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/prisma/client.ts';
import { requireEnv } from './requireEnv.ts';

export type CrmClient = PrismaClient;
export type CrmTransaction = Prisma.TransactionClient;
export type CrmDatabase = () => CrmClient;

export function createCrmClient(connectionString: string): CrmClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });
}

let shared: CrmClient | undefined;

export const crmDatabase: CrmDatabase = () =>
  (shared ??= createCrmClient(requireEnv('CRM_DATABASE_URL')));

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function lockKey(tx: CrmTransaction, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
