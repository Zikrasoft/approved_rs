import { COMMISSION_PERCENT, serviceLabel } from '@podbor/brands';
import {
  createEnsureLeadCard,
  createFormatter,
  createLeadSchema,
  createLeadStore,
  createNotifier,
  createTelegramClient,
  parseIds,
  LEADS_PATH,
  type StoredLead,
} from '@podbor/lead-crm';
import { createVercelBlobStorage } from '@podbor/lead-crm/storage/vercel-blob';
import { z } from 'zod';

const SEND_DELAY_MS = 120;
const CLOSED_STATUSES = ['won', 'lost'] as const;

const USAGE =
  'Usage: node --env-file=.env.local --experimental-strip-types scripts/backfill-crm-cards.ts [--dry-run | --apply]';

const flags = z
  .array(z.enum(['--dry-run', '--apply']))
  .safeParse(process.argv.slice(2));

if (!flags.success) {
  console.error(`Unknown argument in: ${process.argv.slice(2).join(' ')}`);
  console.error(USAGE);
  process.exit(1);
}

const apply = flags.data.includes('--apply');

const env = z
  .object({
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_BOT_USERNAME: z.string().min(1),
    TELEGRAM_GROUP_ID: z.string().min(1),
    TELEGRAM_OWNER_ID: z.string().min(1),
    TELEGRAM_ADMIN_ID: z.string().min(1),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
  })
  .safeParse(process.env);

if (!env.success) {
  console.error(
    'Missing env vars:',
    Object.keys(z.flattenError(env.error).fieldErrors).join(', '),
  );
  process.exit(1);
}

const store = createLeadStore({
  storage: createVercelBlobStorage({ path: LEADS_PATH }),
  schema: createLeadSchema({
    defaultCommissionPercent: COMMISSION_PERCENT.approved,
  }),
});

const ensureLeadCard = createEnsureLeadCard({
  store,
  notifier: createNotifier({
    client: createTelegramClient(env.data.TELEGRAM_BOT_TOKEN),
    formatter: createFormatter({
      serviceLabel,
      botUsername: env.data.TELEGRAM_BOT_USERNAME,
    }),
    groupId: env.data.TELEGRAM_GROUP_ID,
    ownerIds: parseIds(env.data.TELEGRAM_OWNER_ID),
    adminIds: parseIds(env.data.TELEGRAM_ADMIN_ID),
  }),
});

function needsRedraw(lead: StoredLead): boolean {
  return (
    !lead.archived &&
    !(CLOSED_STATUSES as readonly string[]).includes(lead.status)
  );
}

function describe(lead: StoredLead): string {
  const at =
    lead.telegramChatId == null || lead.telegramMessageId == null
      ? 'no card yet'
      : `${lead.telegramChatId}/${lead.telegramMessageId}`;
  return `#${lead.id} ${lead.brand} · ${lead.status} · ${at}`;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const leads = (await store.readLeads()).filter(needsRedraw);

console.log(
  `${leads.length} open lead(s) to redraw as @${env.data.TELEGRAM_BOT_USERNAME}${apply ? '' : ' (dry run — nothing will be written)'}`,
);

let redrawn = 0;
let failed = 0;

for (const lead of leads) {
  if (!apply) {
    console.log(`would redraw ${describe(lead)}`);
    continue;
  }
  try {
    await ensureLeadCard(lead);
    const after = await store.getLead(lead.id);
    console.log(
      `redrew ${describe(lead)} -> ${after ? describe(after) : 'gone'}`,
    );
    redrawn += 1;
  } catch (err) {
    console.error(`failed ${describe(lead)}`, err);
    failed += 1;
  }
  await sleep(SEND_DELAY_MS);
}

if (!apply) {
  console.log('Re-run with --apply to write.');
} else {
  console.log(`Redrawn: ${redrawn}, failed: ${failed}`);
  if (failed > 0) process.exit(1);
}
