import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';
import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import { parseEnv } from '../env';
import { deploySite } from './deploy';
import {
  markNumbersPublished,
  partNumberIds,
  unmarkNumbersPublished,
} from './published';
import { translateCatalogue } from './translate';
import { type RunOutcome, startCatalogueRun } from '../catalogue-writer';
import { errorMessage } from '../errors';

export const PUBLISH_REINDEX_REGISTRATION = 'publishReindex';

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
      const fresh = await markNumbersPublished(
        scope,
        await partNumberIds(scope),
      );
      try {
        await deploySite(parseEnv(process.env).PUBLISH_DISPATCH_TOKEN);
      } catch (error) {
        await unmarkNumbersPublished(scope, fresh);
        throw error;
      }
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

export async function latestPublishRun(scope: MedusaContainer) {
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const [latest] = await publish.listCatalogueRuns(
    { kind: 'publish' },
    { order: { created_at: 'DESC' }, take: 1 },
  );
  return latest ?? null;
}

export const startPublishRun = (
  scope: MedusaContainer,
  actorId: string | null,
) =>
  startCatalogueRun(
    scope,
    { kind: 'publish', created_by: actorId },
    () => runSteps(publishSteps(scope)),
    (failure): RunOutcome => (failure ? { status: 'failed', ...failure } : {}),
  );
