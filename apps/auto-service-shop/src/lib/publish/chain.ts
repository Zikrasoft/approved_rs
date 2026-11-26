import { setTimeout as sleep } from 'node:timers/promises';

import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { partPageSlug } from '@podbor/catalog-contract';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import { PART_IDENTIFIER_INDEX } from '../../search/part-changed-event';
import { CATALOGUE_CAR_INDEX } from '../car-pages';
import { parseEnv } from '../env';
import {
  identifiersToPurge,
  identifiersToReindex,
  NO_CHANGES,
  unfinishedChanges,
  withChanges,
} from './changes';
import { sweepOrphans } from './orphans';
import {
  CATALOGUE_HUB_PATTERNS,
  cachePurge,
  partPagePattern,
  type PublishPurge,
} from './purge';
import { translateCatalogue } from './translate';
import { clearCatalogueMemo } from '../catalogue-memo';
import { cataloguePageList } from '../catalogue-page-list';
import { type RunOutcome, startCatalogueRun } from '../catalogue-writer';
import { errorMessage } from '../errors';
import {
  emitIndexChanges,
  hasNoActiveVersion,
  type IndexChanges,
} from '../index-changes';
import { logEvent } from '../log-event';

export type { PublishPurge } from './purge';

export const PUBLISH_SEARCH_REGISTRATION = 'publishSearch';

export const PUBLISH_PURGE_REGISTRATION = 'publishPurge';

const SHRINK_FLOOR = 0.5;

export type PublishSearch = {
  changed: (changes: IndexChanges) => Promise<void>;
  swap: (index: string) => Promise<void>;
  partsIndexActive: () => Promise<boolean>;
  settledPublishedDocuments: (published: number) => Promise<number>;
};

const SETTLE_TRIES = 12;

const SETTLE_PAUSE_MS = 5_000;

type PublishStep = { name: string; run: () => Promise<unknown> };

const searchModule = (scope: MedusaContainer) =>
  scope.resolve<ISearchModuleService>(Modules.SEARCH);

async function publishedDocuments(scope: MedusaContainer) {
  const { metadata } = await searchModule(scope).search({
    entity: PART_IDENTIFIER_INDEX,
    filters: { published: true },
    pagination: { skip: 0, take: 1 },
  });
  return metadata?.count ?? 0;
}

async function settledPublishedDocuments(
  scope: MedusaContainer,
  published: number,
) {
  for (let attempt = 1; ; attempt += 1) {
    const indexed = await publishedDocuments(scope);
    if (indexed === published || attempt >= SETTLE_TRIES) return indexed;
    await sleep(SETTLE_PAUSE_MS);
  }
}

const searchOf = (scope: MedusaContainer): PublishSearch =>
  scope.hasRegistration(PUBLISH_SEARCH_REGISTRATION)
    ? scope.resolve<PublishSearch>(PUBLISH_SEARCH_REGISTRATION)
    : {
        changed: (changes) => emitIndexChanges(scope, changes),
        swap: async (index) => {
          await searchModule(scope).reindex({ index, strategy: 'swap' });
        },
        partsIndexActive: async () => !(await hasNoActiveVersion(scope)),
        settledPublishedDocuments: (published) =>
          settledPublishedDocuments(scope, published),
      };

const purgeOf = (scope: MedusaContainer): PublishPurge =>
  scope.hasRegistration(PUBLISH_PURGE_REGISTRATION)
    ? scope.resolve<PublishPurge>(PUBLISH_PURGE_REGISTRATION)
    : cachePurge(parseEnv(process.env).CACHE_PURGE_URL);

async function partPageSlugsOf(
  scope: MedusaContainer,
  identifierIds: string[],
) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { id: identifierIds },
    {
      select: ['normalized_value', 'brand.slug'],
      relations: ['brand'],
      withDeleted: true,
      take: null,
    },
  );
  return identifiers.flatMap(({ brand, normalized_value }) =>
    brand ? [partPageSlug(brand.slug, normalized_value)] : [],
  );
}

async function partIdsOf(scope: MedusaContainer, identifierIds: string[]) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    { id: identifierIds },
    { select: ['part_id'], take: null },
  );
  return identifiers.map(({ part_id }) => part_id);
}

async function checkShrink(publish: PublishModuleService) {
  const { published, projected } = await publish.partPageCounts();
  if (
    projected < published * SHRINK_FLOOR &&
    !parseEnv(process.env).CATALOGUE_SHRINK_ALLOWED
  ) {
    throw new Error(
      `The Publish would leave ${projected} Part pages, under half of the ${published} published now; set CATALOGUE_SHRINK_ALLOWED=true in the shop env for one Publish if that is intended`,
    );
  }
}

async function checkPublishedCount(
  search: PublishSearch,
  publish: PublishModuleService,
) {
  const published = await publish.countPublished();
  const indexed = await search.settledPublishedDocuments(published);
  if (indexed !== published) {
    logEvent('search.drift', {
      outcome: 'mismatch',
      index: PART_IDENTIFIER_INDEX,
      indexed,
      published,
    });
  }
}

const publishChain = (scope: MedusaContainer) => {
  const publish = scope.resolve<PublishModuleService>(PUBLISH_MODULE);
  const search = searchOf(scope);
  const purge = purgeOf(scope);
  let changes = NO_CHANGES;
  let published = 0;
  const steps: PublishStep[] = [
    {
      name: 'shrink',
      run: async () => {
        changes = withChanges(changes, await unfinishedChanges(publish));
        await checkShrink(publish);
      },
    },
    {
      name: 'sweep',
      run: async () => {
        changes = withChanges(changes, {
          sweptIdentifiers: await sweepOrphans(scope),
        });
      },
    },
    {
      name: 'translate',
      run: async () => {
        changes = withChanges(changes, {
          translatedParts: [
            ...(await translateCatalogue(
              scope.resolve(CATALOG_MODULE),
              parseEnv(process.env).OPENAI_API_KEY,
            )),
          ],
        });
      },
    },
    {
      name: 'publish',
      run: async () => {
        changes = withChanges(changes, await publish.publishAll());
        clearCatalogueMemo();
        published = await publish.countPublished();
        await cataloguePageList(scope);
      },
    },
    {
      name: 'reindex',
      run: async () => {
        if (!(await search.partsIndexActive())) {
          await search.swap(PART_IDENTIFIER_INDEX);
          await search.swap(CATALOGUE_CAR_INDEX);
          return;
        }
        const identifierParts = await partIdsOf(
          scope,
          identifiersToReindex(changes),
        );
        await search.changed({
          partIds: [
            ...new Set([...identifierParts, ...changes.translatedParts]),
          ],
          deletedIdentifierIds: changes.sweptIdentifiers,
        });
        await search.swap(CATALOGUE_CAR_INDEX);
        await checkPublishedCount(search, publish);
      },
    },
    {
      name: 'purge',
      run: async () => {
        const slugs = await partPageSlugsOf(scope, identifiersToPurge(changes));
        for (const pattern of [
          ...CATALOGUE_HUB_PATTERNS,
          ...[...new Set(slugs)].map(partPagePattern),
        ]) {
          await purge(pattern);
        }
      },
    },
  ];
  return {
    steps,
    report: () => ({ published }),
    unfinished: () => ({ published, unfinished: changes }),
  };
};

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
) => {
  const chain = publishChain(scope);
  return startCatalogueRun(
    scope,
    { kind: 'publish', created_by: actorId },
    () => runSteps(chain.steps),
    (failure): RunOutcome =>
      failure
        ? { status: 'failed', ...failure, report: chain.unfinished() }
        : { report: chain.report() },
  );
};
