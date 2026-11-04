import type { MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';
import { z } from 'zod';

import { PUBLISH_MODULE } from '../modules/publish';
import type { CATALOGUE_RUN_KINDS } from '../modules/publish/models/catalogue-run';
import type PublishModuleService from '../modules/publish/service';
import { adminError } from '../modules/_shared/admin-error';
import { errorMessage } from './errors';
import { logEvent, MAX_CAUSE_LENGTH } from './log-event';
import { ABANDONED } from '../modules/_shared/run-errors';

const WRITER_LOCK = "hashtextextended('catalogue-writer', 0)";

const writerLocks = new Map<string, () => Promise<void>>();

const writerLockSchema = z.object({ locked: z.boolean() });

type RunStart = {
  kind: (typeof CATALOGUE_RUN_KINDS)[number];
  supplier_id?: string;
  created_by: string | null;
};

export type RunOutcome = {
  status?: 'failed';
  failed_step?: string;
  error?: string;
  report?: Record<string, unknown>;
};

type FinishedRun = {
  id: string;
  kind: string;
  supplier_id: string | null;
  status: string;
  failed_step: string | null;
  error: string | null;
  report: Record<string, unknown> | null;
  created_at: Date | string;
  finished_at: Date | string | null;
};

const reportCounts = (report: Record<string, unknown> | null) =>
  Object.fromEntries(
    Object.entries(report ?? {}).flatMap(([key, value]) =>
      typeof value === 'number'
        ? [[key, value]]
        : Array.isArray(value)
          ? [[key, value.length]]
          : [],
    ),
  );

const logRun = (run: FinishedRun) => {
  const failed = run.status === 'failed';
  logEvent('catalogue.run', {
    outcome: failed ? 'failed' : 'succeeded',
    reason: failed ? (run.failed_step ?? 'exception') : null,
    kind: run.kind,
    run: run.id,
    supplier: run.supplier_id,
    duration_ms:
      new Date(run.finished_at ?? Date.now()).getTime() -
      new Date(run.created_at).getTime(),
    cause: run.error && run.error.slice(0, MAX_CAUSE_LENGTH),
    counts: reportCounts(run.report),
  });
};

const runsOf = (scope: MedusaContainer): PublishModuleService =>
  scope.resolve(PUBLISH_MODULE);

const busy = () =>
  adminError(
    MedusaError.Types.CONFLICT,
    'CATALOGUE_BUSY',
    'Another import, publish, deletion, merge or rename is running',
  );

async function takeWriterLock(
  scope: MedusaContainer,
): Promise<(() => Promise<void>) | null> {
  const pg = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const connection: unknown = await pg.client.acquireConnection();
  const release = async () => {
    await pg.client.releaseConnection(connection);
  };
  const { rows } = await pg
    .raw(`select pg_try_advisory_lock(${WRITER_LOCK}) as locked`)
    .connection(connection)
    .catch(async (error: unknown) => {
      await release();
      throw error;
    });
  if (!writerLockSchema.parse(rows[0]).locked) {
    await release();
    return null;
  }
  return async () => {
    await pg
      .raw(`select pg_advisory_unlock(${WRITER_LOCK})`)
      .connection(connection)
      .finally(release);
  };
}

export async function claimCatalogueWriter(
  scope: MedusaContainer,
  start: RunStart,
) {
  const unlock = await takeWriterLock(scope);
  if (!unlock) throw busy();
  try {
    const runs = runsOf(scope);
    const [abandoned] = await runs.listCatalogueRuns(
      { status: 'running' },
      { take: 1 },
    );
    if (abandoned) {
      await runs.updateCatalogueRuns({
        id: abandoned.id,
        status: 'failed',
        error: ABANDONED,
        finished_at: new Date(),
      });
    }
    const run = await runs.createCatalogueRuns({
      ...start,
      status: 'running',
      // TODO: nothing reads heartbeat_at since the advisory lock; drop the column in the pre-launch squash.
      heartbeat_at: new Date(),
    });
    writerLocks.set(run.id, unlock);
    return run;
  } catch (error) {
    await unlock();
    throw error;
  }
}

export async function holdCatalogueWriter<T>(
  scope: MedusaContainer,
  runId: string,
  work: () => Promise<T>,
  outcome: (result: T) => RunOutcome = () => ({}),
): Promise<T> {
  const runs = runsOf(scope);
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER);
  const finish = (fields: RunOutcome) =>
    runs
      .updateCatalogueRuns({
        selector: { id: runId, status: 'running' },
        data: { status: 'succeeded', ...fields, finished_at: new Date() },
      })
      .then(([finished]) => finished && logRun(finished))
      .catch((error: unknown) => {
        logger.error(
          `Catalogue run ${runId} was not recorded: ${errorMessage(error)}`,
        );
      });
  try {
    const result = await work();
    await finish(outcome(result));
    return result;
  } catch (error) {
    logger.warn(`Catalogue run ${runId} failed: ${errorMessage(error)}`);
    await finish({ status: 'failed', error: errorMessage(error) });
    throw error;
  } finally {
    await writerLocks.get(runId)?.();
    writerLocks.delete(runId);
  }
}

export const importRunsOf = (
  scope: MedusaContainer,
  supplierId: string,
  take: number,
) =>
  runsOf(scope).listCatalogueRuns(
    { kind: 'import', supplier_id: supplierId },
    { order: { created_at: 'DESC' }, take },
  );

export async function startCatalogueRun<T>(
  scope: MedusaContainer,
  start: RunStart,
  work: (runId: string) => Promise<T>,
  outcome?: (result: T) => RunOutcome,
) {
  const run = await claimCatalogueWriter(scope, start);
  holdCatalogueWriter(scope, run.id, () => work(run.id), outcome).catch(
    () => undefined,
  );
  return run;
}
