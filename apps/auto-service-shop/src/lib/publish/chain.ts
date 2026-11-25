import { setTimeout as sleep } from 'node:timers/promises';

import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { partPageSlug } from '@podbor/catalog-contract';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';
import { PART_IDENTIFIER_INDEX } from '../../search/part-changed-event';
import { CATALOGUE_CAR_INDEX } from '../car-pages';
import { parseEnv } from '../env';
import { sweepOrphans } from './orphans';
import {
  CATALOGUE_HUB_PATTERNS,
  cachePurge,
  partPagePattern,
  type PublishPurge,
} from './purge';
import { translateCatalogue } from './translate';
import { warmCatalogueMemo } from '../catalogue-page-list';
import { type RunOutcome, startCatalogueRun } from '../catalogue-writer';
import { errorMessage } from '../errors';
import {
  emitIndexChanges,
  hasNoActiveVersion,
  type IndexChanges,
} from '../index-changes';
import { logEvent } from '../log-event';

export type { PublishPurge } from './purge';

export const PUBLISH_REINDEX_REGISTRATION = 'publishReindex';

export const PUBLISH_PURGE_REGISTRATION = 'publishPurge';

const SHRINK_FLOOR = 0.5;

export type PublishSearch = {
  changed: (changes: IndexChanges) => Promise<void>;
  swap: (index: string) => Promise<void>;
  partsIndexActive: () => Promise<boolean>;
  publishedDocuments: () => Promise<number>;
  countSettle: { tries: number; pauseMs: number };
};

export type PublishChanges = {
  fresh: string[];
  listedFlipped: string[];
  translatedParts: string[];
  sweptIdentifiers: string[];
};

type PublishStep = { name: string; run: () => Promise<unknown> };

const searchModule = (scope: MedusaContainer) =>
  scope.resolve<ISearchModuleService>(Modules.SEARCH);

const searchOf = (scope: MedusaContainer): PublishSearch =>
  scope.hasRegistration(PUBLISH_REINDEX_REGISTRATION)
    ? scope.resolve<PublishSearch>(PUBLISH_REINDEX_REGISTRATION)
    : {
        changed: (changes) => emitIndexChanges(scope, changes),
        swap: async (index) => {
          await searchModule(scope).reindex({ index, strategy: 'swap' });
        },
        partsIndexActive: async () => !(await hasNoActiveVersion(scope)),
        publishedDocuments: async () =>
          (
            await searchModule(scope).search({
              entity: PART_IDENTIFIER_INDEX,
              filters: { published: true },
              pagination: { skip: 0, take: 1 },
            })
          ).metadata?.count ?? 0,
        countSettle: { tries: 12, pauseMs: 5_000 },
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

const publishedReportSchema = z.object({ published: z.number() });

async function lastPublished(publish: PublishModuleService) {
  const [last] = await publish.listCatalogueRuns(
    { kind: 'publish', status: 'succeeded' },
    { select: ['report'], order: { created_at: 'DESC' }, take: 1 },
  );
  return publishedReportSchema.safeParse(last?.report).data?.published ?? 0;
}

async function checkPublishedCount(
  search: PublishSearch,
  publish: PublishModuleService,
) {
  for (let attempt = 1; ; attempt += 1) {
    const [indexed, published] = await Promise.all([
      search.publishedDocuments(),
      publish.countPublished(),
    ]);
    if (indexed === published) return;
    if (attempt >= search.countSettle.tries) {
      logEvent('search.drift', {
        outcome: 'mismatch',
        index: PART_IDENTIFIER_INDEX,
        indexed,
        published,
      });
      return;
    }
    await sleep(search.countSettle.pauseMs);
  }
}

const publishChain = (scope: MedusaContainer) => {
  const publish = scope.resolve<PublishModuleService>(PUBLISH_MODULE);
  const search = searchOf(scope);
  const purge = purgeOf(scope);
  const changes: PublishChanges = {
    fresh: [],
    listedFlipped: [],
    translatedParts: [],
    sweptIdentifiers: [],
  };
  let published = 0;
  const steps: PublishStep[] = [
    {
      name: 'sweep',
      run: async () => {
        changes.sweptIdentifiers = await sweepOrphans(scope);
      },
    },
    {
      name: 'translate',
      run: async () => {
        changes.translatedParts = [
          ...(await translateCatalogue(
            scope.resolve(CATALOG_MODULE),
            parseEnv(process.env).OPENAI_API_KEY,
          )),
        ];
      },
    },
    {
      name: 'publish',
      run: async () => {
        const before = await lastPublished(publish);
        Object.assign(changes, await publish.publishAll());
        published = await publish.countPublished();
        if (
          published < before * SHRINK_FLOOR &&
          !parseEnv(process.env).CATALOGUE_SHRINK_ALLOWED
        ) {
          await publish.unpublish(changes.fresh);
          throw new Error(
            `The Publish would leave ${published} published numbers, under half of the ${before} the last Publish left; set CATALOGUE_SHRINK_ALLOWED=true in the shop env for one Publish if that is intended`,
          );
        }
        await warmCatalogueMemo(scope);
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
        const identifierParts = await partIdsOf(scope, [
          ...changes.fresh,
          ...changes.listedFlipped,
        ]);
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
        const slugs = await partPageSlugsOf(scope, [
          ...changes.fresh,
          ...changes.listedFlipped,
          ...changes.sweptIdentifiers,
        ]);
        for (const pattern of [
          ...CATALOGUE_HUB_PATTERNS,
          ...[...new Set(slugs)].map(partPagePattern),
        ]) {
          await purge(pattern);
        }
      },
    },
  ];
  return { steps, report: () => ({ published }) };
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
      failure ? { status: 'failed', ...failure } : { report: chain.report() },
  );
};
