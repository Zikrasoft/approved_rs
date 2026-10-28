import type { MedusaContainer } from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
} from '@medusajs/framework/utils';

import { PUBLISH_MODULE } from '../modules/publish';
import type { CATALOGUE_RUN_KINDS } from '../modules/publish/models/catalogue-run';
import type PublishModuleService from '../modules/publish/service';
import { adminError } from './admin-errors';
import { errorMessage } from './errors';

export const HEARTBEAT_MS = 30_000;
export const STALE_HEARTBEAT_MS = 5 * 60_000;
export const ABANDONED = 'Abandoned';

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

const runsOf = (scope: MedusaContainer): PublishModuleService =>
  scope.resolve(PUBLISH_MODULE);

const busy = () =>
  adminError(
    MedusaError.Types.CONFLICT,
    'CATALOGUE_BUSY',
    'Another import, publish or deletion is running',
  );

const isStale = (heartbeatAt: Date) =>
  Date.now() - new Date(heartbeatAt).getTime() >= STALE_HEARTBEAT_MS;

export async function claimCatalogueWriter(
  scope: MedusaContainer,
  start: RunStart,
) {
  const runs = runsOf(scope);
  const [running] = await runs.listCatalogueRuns(
    { status: 'running' },
    { take: 1 },
  );
  if (running) {
    if (!isStale(running.heartbeat_at)) throw busy();
    await runs.updateCatalogueRuns({
      id: running.id,
      status: 'failed',
      error: ABANDONED,
      finished_at: new Date(),
    });
  }
  return runs
    .createCatalogueRuns({
      ...start,
      status: 'running',
      heartbeat_at: new Date(),
    })
    .catch((error: unknown) => {
      throw MedusaError.isMedusaError(error) &&
        error.type === MedusaError.Types.INVALID_DATA
        ? busy()
        : error;
    });
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
      .catch((error: unknown) => {
        logger.error(
          `Catalogue run ${runId} was not recorded: ${errorMessage(error)}`,
        );
      });
  const heartbeat = setInterval(() => {
    runs
      .updateCatalogueRuns({
        selector: { id: runId, status: 'running' },
        data: { heartbeat_at: new Date() },
      })
      .catch((error: unknown) => {
        logger.error(
          `Catalogue run ${runId} heartbeat failed: ${errorMessage(error)}`,
        );
      });
  }, HEARTBEAT_MS);
  try {
    const result = await work();
    await finish(outcome(result));
    return result;
  } catch (error) {
    logger.warn(`Catalogue run ${runId} failed: ${errorMessage(error)}`);
    await finish({ status: 'failed', error: errorMessage(error) });
    throw error;
  } finally {
    clearInterval(heartbeat);
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
