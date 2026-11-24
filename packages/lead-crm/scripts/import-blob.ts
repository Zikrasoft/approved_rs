import { BlobNotFoundError, get, list } from '@vercel/blob';
import { crmDatabase } from '../src/database.ts';
import {
  countLegacy,
  importLegacy,
  LEGACY_PATHS,
  readLegacy,
} from '../src/legacy/import.ts';
import { requireEnv } from '../src/requireEnv.ts';

const dryRun = process.argv.includes('--dry-run');

requireEnv('BLOB_READ_WRITE_TOKEN');
if (!dryRun) requireEnv('CRM_DATABASE_URL');

async function readBlob(path: string): Promise<unknown> {
  const result = await get(path, { access: 'private', useCache: false }).catch(
    (error: unknown) => {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    },
  );
  if (!result) return undefined;
  return JSON.parse(await new Response(result.stream).text()) as unknown;
}

async function countOrderMarkers(): Promise<number> {
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: 'shop-orders/', cursor });
    count += page.blobs.length;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return count;
}

const records = readLegacy({
  leads: await readBlob(LEGACY_PATHS.leads),
  ledger: await readBlob(LEGACY_PATHS.ledger),
  quarantine: await readBlob(LEGACY_PATHS.quarantine),
});

const counts = dryRun
  ? countLegacy(records)
  : await importLegacy(crmDatabase, records);

console.log(dryRun ? 'Dry run, nothing written:' : 'Imported into crm:');
console.table({ ...counts, orderMarkersSkipped: await countOrderMarkers() });
if (!dryRun) await crmDatabase().$disconnect();
