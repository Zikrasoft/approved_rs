import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, inject } from 'vitest';
import { createCrmClient, crmDatabase } from '../database.ts';

const templateUrl = new URL(inject('crmAdminUrl'));
const template = templateUrl.pathname.slice(1);
const name = `${template}_${randomBytes(4).toString('hex')}`;

const admin = createCrmClient(new URL('/postgres', templateUrl).href);
await admin.$executeRawUnsafe(
  `CREATE DATABASE "${name}" TEMPLATE "${template}"`,
);
await admin.$disconnect();

process.env.CRM_DATABASE_URL = new URL(`/${name}`, templateUrl).href;

const tables = await crmDatabase().$queryRaw<{ name: string }[]>`
  SELECT tablename AS name FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
const truncate = `TRUNCATE ${tables.map(({ name }) => `"${name}"`).join(', ')} RESTART IDENTITY`;

beforeEach(async () => {
  await crmDatabase().$executeRawUnsafe(truncate);
});

afterAll(async () => {
  await crmDatabase().$disconnect();
});
