import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import { parseEnv } from '../env';
import { importSupplierCatalogues } from '../suppliers/import';
import { deploySite } from './deploy';
import { markNumbersPublished, partNumberIds } from './published';
import { translateCatalogue } from './translate';
import { adminError } from '../admin-errors';
import { errorMessage } from '../errors';

export const PUBLISH_REINDEX_REGISTRATION = 'publishReindex';

const ABANDONED_RUN_MS = 2 * 60 * 60 * 1000;

type PublishStep = { name: string; run: () => Promise<unknown> };

type Reindex = () => Promise<unknown>;

const reindex = (scope: MedusaContainer): Reindex =>
  scope.hasRegistration(PUBLISH_REINDEX_REGISTRATION)
    ? scope.resolve<Reindex>(PUBLISH_REINDEX_REGISTRATION)
    : () =>
        scope
          .resolve<ISearchModuleService>(Modules.SEARCH)
          .reindex({ strategy: 'swap' });

const publishSteps = (scope: MedusaContainer): PublishStep[] => [
  { name: 'import', run: () => importSupplierCatalogues(scope) },
  {
    name: 'translate',
    run: () =>
      translateCatalogue(
        scope.resolve(CATALOG_MODULE),
        parseEnv(process.env).OPENAI_API_KEY,
      ),
  },
  {
    name: 'deploy',
    run: async () => {
      const built = await partNumberIds(scope);
      await deploySite(parseEnv(process.env).PUBLISH_DISPATCH_TOKEN);
      await markNumbersPublished(scope, built);
    },
  },
  { name: 'reindex', run: reindex(scope) },
];

type StepFailure = { failed_step: string; error: string };

async function runSteps(steps: PublishStep[]): Promise<StepFailure | null> {
  for (const step of steps) {
    try {
      await step.run();
    } catch (error) {
      return {
        failed_step: step.name,
        error: errorMessage(error),
      };
    }
  }
  return null;
}

async function finishRun(scope: MedusaContainer, id: string): Promise<void> {
  const logger = scope.resolve(ContainerRegistrationKeys.LOGGER);
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  try {
    const failure = await runSteps(publishSteps(scope));
    if (failure) {
      logger.error(
        `Publish run ${id} failed at ${failure.failed_step}: ${failure.error}`,
      );
    }
    await publish.updatePublishRuns({
      id,
      status: failure ? 'failed' : 'succeeded',
      failed_step: failure?.failed_step ?? null,
      error: failure?.error ?? null,
      finished_at: new Date(),
    });
  } catch (error) {
    logger.error(`Publish run ${id} was not recorded: ${String(error)}`);
  }
}

export async function latestPublishRun(scope: MedusaContainer) {
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const [latest] = await publish.listPublishRuns(
    {},
    { order: { created_at: 'DESC' }, take: 1 },
  );
  return latest ?? null;
}

const runningConflict = () =>
  adminError(
    MedusaError.Types.CONFLICT,
    'PUBLISH_RUNNING',
    'A publish run is already in progress',
  );

export async function startPublishRun(
  scope: MedusaContainer,
  actorId: string | null,
) {
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const latest = await latestPublishRun(scope);
  if (latest?.status === 'running') {
    if (Date.now() - new Date(latest.created_at).getTime() < ABANDONED_RUN_MS) {
      throw runningConflict();
    }
    await publish.updatePublishRuns({
      id: latest.id,
      status: 'failed',
      error: 'Abandoned',
      finished_at: new Date(),
    });
  }
  const run = await publish
    .createPublishRuns({ status: 'running', created_by: actorId })
    .catch((error: unknown) => {
      throw MedusaError.isMedusaError(error) &&
        error.type === MedusaError.Types.INVALID_DATA
        ? runningConflict()
        : error;
    });
  void finishRun(scope, run.id);
  return run;
}
