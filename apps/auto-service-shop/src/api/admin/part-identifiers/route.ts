import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { withEditors } from '../../../lib/editors';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { AdminListPartIdentifiersType } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListPartIdentifiersType>,
  res: MedusaResponse,
): Promise<void> {
  const filters = req.validatedQuery as AdminListPartIdentifiersType;

  const {
    rows: page,
    count,
    counts,
  } = await req.scope
    .resolve<CatalogModuleService>(CATALOG_MODULE)
    .identifierStatusRows(filters);

  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers = await suppliers.storeOffersFor(page.map(({ id }) => id));

  res.json({
    part_identifiers: await withEditors(
      req.scope,
      page.map((row) => ({
        id: row.id,
        value: row.value,
        normalized_value: row.normalized_value,
        brand: { id: row.brand_id, name: row.brand_name },
        part: {
          id: row.part_id,
          name: row.part_name,
          source_missing_since: row.source_missing_since?.toISOString() ?? null,
        },
        category:
          row.category_id && row.category_name
            ? { id: row.category_id, name: row.category_name }
            : null,
        enriched: !row.bare_number,
        reasons: row.bare_number ? ['bare_number'] : [],
        photos: row.photos,
        offers: offers.get(row.id)?.length ?? 0,
        updated_by: row.updated_by,
        updated_at: row.updated_at.toISOString(),
      })),
    ),
    count,
    counts,
    offset: filters.offset,
    limit: filters.limit,
  });
}
