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

beforeEach(async () => {
  await crmDatabase().$executeRawUnsafe(
    'TRUNCATE leads, digests, digest_leads, ledger_operations, operation_prompts, quarantined_records RESTART IDENTITY',
  );
});

afterAll(async () => {
  await crmDatabase().$disconnect();
});
