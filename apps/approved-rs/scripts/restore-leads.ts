import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LEADS_PATH } from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { z } from 'zod';

const USAGE =
  'Usage: node --env-file=.env.local --experimental-strip-types scripts/restore-leads.ts <backup.json> [--apply]';

const args = z
  .tuple([z.string().min(1)])
  .rest(z.literal('--apply'))
  .safeParse(process.argv.slice(2));

if (!args.success) {
  console.error(USAGE);
  process.exit(1);
}

const [path, ...flags] = args.data;
const apply = flags.includes('--apply');

const env = z
  .object({ BLOB_READ_WRITE_TOKEN: z.string().min(1) })
  .safeParse(process.env);

if (!env.success) {
  console.error(
    'BLOB_READ_WRITE_TOKEN is not set — pull it with `vercel env pull` in apps/approved-rs',
  );
  process.exit(1);
}

const file = resolve(process.cwd(), path);
const records = z
  .array(z.unknown())
  .safeParse(JSON.parse(await readFile(file, 'utf8')));

if (!records.success) {
  console.error(`${file} is not a JSON array of lead records — refusing`);
  process.exit(1);
}

const storage = createVercelBlobStorage({ path: LEADS_PATH });
const { raw, version } = await storage.read();
const live = z.array(z.unknown()).safeParse(raw);

console.log(`Backup:    ${file} — ${records.data.length} record(s)`);
console.log(
  `Live blob: ${LEADS_PATH} — ${live.success ? `${live.data.length} record(s)` : 'unreadable or missing'}`,
);

if (!apply) {
  console.log('Dry run — nothing written. Re-run with --apply to overwrite.');
  process.exit(0);
}

await storage.write(records.data, version);
console.log(`Restored ${records.data.length} record(s) to ${LEADS_PATH}`);
