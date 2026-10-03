import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { LEADS_PATH } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { z } from 'zod';

const BACKUP_DIR = '.local';

const env = z
  .object({ BLOB_READ_WRITE_TOKEN: z.string().min(1) })
  .safeParse(process.env);

if (!env.success) {
  console.error(
    'BLOB_READ_WRITE_TOKEN is not set — pull it with `vercel env pull` in apps/approved-rs',
  );
  process.exit(1);
}

const { raw } = await createVercelBlobStorage({ path: LEADS_PATH }).read();

if (raw === undefined) {
  console.error(
    `${LEADS_PATH} does not exist in the blob store — nothing to back up`,
  );
  process.exit(1);
}

const records = z.array(z.unknown()).safeParse(raw);
if (!records.success) {
  console.error(
    `${LEADS_PATH} is ${typeof raw}, not an array — backing it up anyway, but read it before going further`,
  );
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = resolve(process.cwd(), BACKUP_DIR);
const file = join(dir, `leads-${stamp}.json`);

await mkdir(dir, { recursive: true });
await writeFile(file, JSON.stringify(raw, null, 2), 'utf8');

console.log(`Backed up ${LEADS_PATH} to ${file}`);
console.log(`Records: ${records.success ? records.data.length : 'unknown'}`);
