import type { MedusaContainer } from '@medusajs/framework/types';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { PUBLISH_MODULE } from '../../modules/publish';
import type PublishModuleService from '../../modules/publish/service';

export async function partNumberIds(scope: MedusaContainer): Promise<string[]> {
  const catalog: CatalogModuleService = scope.resolve(CATALOG_MODULE);
  const identifiers = await catalog.listPartIdentifiers(
    {},
    { select: ['id'], take: null },
  );
  return identifiers.map(({ id }) => id);
}

export async function markNumbersPublished(
  scope: MedusaContainer,
  ids: string[],
): Promise<void> {
  const publish: PublishModuleService = scope.resolve(PUBLISH_MODULE);
  const known = new Set(
    (await publish.listPublishedNumbers({ id: ids }, { take: null })).map(
      ({ id }) => id,
    ),
  );
  const fresh = ids.filter((id) => !known.has(id));
  if (fresh.length) {
    await publish.createPublishedNumbers(fresh.map((id) => ({ id })));
  }
}

export const publishAllNumbers = async (scope: MedusaContainer) =>
  markNumbersPublished(scope, await partNumberIds(scope));
