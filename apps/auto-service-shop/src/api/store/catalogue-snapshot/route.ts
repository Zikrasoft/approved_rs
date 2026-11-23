import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  CATALOGUE_SNAPSHOT_CONTENT_TYPE,
  categoriesResponseSchema,
  compactFitment,
  makeListSchema,
  MAX_PAGE,
  partPageSchema,
  SNAPSHOT_END_LINE,
  snapshotSectionLines,
  vehicleSchema,
} from '@podbor/catalog-contract';

import { CATEGORY_RELATIONS, shownCategory } from '../../../lib/categories';
import { loadPartDemand } from '../../../lib/part-demand';
import { partPagesAfter } from '../../../lib/part-pages';
import { pricesShown } from '../../../lib/shop-gate';
import { nextCursor, toFitmentResponse } from '../../../lib/store-response';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { keysetPages } from '../../../modules/_shared/keyset-pages';

const SNAPSHOT_BATCH = 2000;

async function* partPageBatches(scope: MedusaContainer, shown: boolean) {
  const demand = await loadPartDemand(scope);
  for (let after: string | undefined; ;) {
    const { pages, published } = await partPagesAfter(scope, {
      after,
      limit: MAX_PAGE,
      shown,
      demand,
    });
    yield pages.map((page) => partPageSchema.parse(page));
    after = nextCursor(published, MAX_PAGE) ?? undefined;
    if (!after) return;
  }
}

async function* rowBatches<T>(
  read: (after: string, take: number) => Promise<unknown[]>,
  shape: (row: unknown) => T,
) {
  for await (const rows of keysetPages(
    async (after, take) => (await read(after ?? '', take)) as { id: string }[],
    SNAPSHOT_BATCH,
  )) {
    yield rows.map(shape);
  }
}

async function* snapshotLines(scope: MedusaContainer, shown: boolean) {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const { categories } = categoriesResponseSchema.parse({
    categories: (
      await catalog.listCategories(
        {},
        { relations: CATEGORY_RELATIONS, order: { slug: 'ASC' } },
      )
    ).map(shownCategory),
  });
  yield* snapshotSectionLines('categories', [categories]);
  yield* snapshotSectionLines('pages', partPageBatches(scope, shown));
  yield* snapshotSectionLines(
    'fitments',
    rowBatches(
      (after, take) => catalog.snapshotFitments(after, take),
      (row) => compactFitment(toFitmentResponse(row)),
    ),
  );
  yield* snapshotSectionLines(
    'vehicles',
    rowBatches(
      (after, take) => catalog.snapshotVehicles(after, take),
      (row) => vehicleSchema.parse(row),
    ),
  );
  const makes = await catalog.listMakes(
    {},
    { select: ['slug', 'name', 'show_on_site'], order: { slug: 'ASC' } },
  );
  yield* snapshotSectionLines('makes', [makeListSchema.parse(makes)]);
  yield SNAPSHOT_END_LINE;
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  res.setHeader(
    'content-type',
    `${CATALOGUE_SNAPSHOT_CONTENT_TYPE}; charset=utf-8`,
  );
  await pipeline(
    Readable.from(snapshotLines(req.scope, pricesShown(req)), {
      highWaterMark: 1,
    }),
    res,
  ).catch((error: unknown) =>
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .error(
        `The catalogue snapshot stopped: ${error instanceof Error ? error.message : String(error)}`,
      ),
  );
}
