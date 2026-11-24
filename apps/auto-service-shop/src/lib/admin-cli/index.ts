import { z } from 'zod';

const adminCliEnvSchema = z.object({
  CARLAB_ADMIN_URL: z.url(),
  CARLAB_ADMIN_API_KEY: z.string().startsWith('sk_'),
});

const runSchema = z.object({
  id: z.string(),
  status: z.string(),
  failed_step: z.string().nullable().catch(null),
  error: z.string().nullable().catch(null),
  report: z.unknown().nullable().catch(null),
});

type Run = z.infer<typeof runSchema>;

const publishRunBodySchema = z.object({ publish_run: runSchema.nullable() });
const importRunBodySchema = z.object({ import_run: runSchema });
const importRunsBodySchema = z.object({ import_runs: z.array(runSchema) });

export const USAGE =
  'usage: admin publish [--wait] | admin import <supplier_id> [--wait] | admin status [<supplier_id>] [--wait]';

export interface AdminCliDeps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  log: (line: string) => void;
  sleep: (ms: number) => Promise<void>;
  pollMs?: number;
}

export async function runAdminCli(
  argv: string[],
  { env, fetch, log, sleep, pollMs = 60_000 }: AdminCliDeps,
): Promise<number> {
  const wait = argv.includes('--wait');
  const [command, supplierId] = argv.filter((arg) => arg !== '--wait');
  const { CARLAB_ADMIN_URL, CARLAB_ADMIN_API_KEY } =
    adminCliEnvSchema.parse(env);
  const authorization = `Basic ${Buffer.from(`${CARLAB_ADMIN_API_KEY}:`).toString('base64')}`;

  const call = async (path: string, method = 'GET'): Promise<unknown> => {
    const response = await fetch(new URL(path, CARLAB_ADMIN_URL), {
      method,
      headers: { authorization, 'content-type': 'application/json' },
      body: method === 'POST' ? '{}' : undefined,
    });
    if (!response.ok) {
      throw new Error(`${method} ${path} answered ${response.status}`);
    }
    return response.json();
  };

  const latestPublish = async (): Promise<Run | null> =>
    publishRunBodySchema.parse(await call('/admin/publish-runs/latest'))
      .publish_run;
  const latestImport = async (): Promise<Run | null> =>
    importRunsBodySchema.parse(
      await call(`/admin/suppliers/${supplierId}/import-runs`),
    ).import_runs[0] ?? null;

  let started: Run | null;
  let latest: () => Promise<Run | null>;
  if (command === 'publish') {
    started = publishRunBodySchema.parse(
      await call('/admin/publish-runs', 'POST'),
    ).publish_run;
    latest = latestPublish;
  } else if (command === 'import' && supplierId) {
    started = importRunBodySchema.parse(
      await call(`/admin/suppliers/${supplierId}/import`, 'POST'),
    ).import_run;
    latest = latestImport;
  } else if (command === 'status') {
    latest = supplierId ? latestImport : latestPublish;
    started = await latest();
  } else {
    log(USAGE);
    return 2;
  }

  let run = started;
  while (wait && run?.status === 'running') {
    await sleep(pollMs);
    run = await latest();
  }
  log(JSON.stringify(run));
  return run && run.status === 'failed' ? 1 : 0;
}

if (require.main === module) {
  runAdminCli(process.argv.slice(2), {
    env: process.env,
    fetch,
    log: (line) => console.log(line),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
