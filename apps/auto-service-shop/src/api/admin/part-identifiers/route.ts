import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { enrichmentGaps } from '@podbor/catalog-contract';

import { withEditors } from '../../../lib/editors';
import { CATALOG_MODULE } from '../../../modules/catalog';
import type CatalogModuleService from '../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { AdminListPartIdentifiersType } from '../validators';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListPartIdentifiersType>,
  res: MedusaResponse,
): Promise<void> {
  const filters = req.validatedQuery as AdminListPartIdentifiersType;
  const { enriched, offset, limit } = filters;

  const rows = await req.scope
    .resolve<CatalogModuleService>(CATALOG_MODULE)
    .identifierStatusRows(filters);
  // TODO: every matching brand-number is loaded and judged per request; persist the status once the catalogue passes ~100k brand-numbers.
  const judged = rows.map((row) => {
    const reasons = enrichmentGaps({
      ...row,
      attributes: row.attributes ?? {},
    });
    return { ...row, reasons, enriched: reasons.length === 0 };
  });
  const matching = judged.filter(
    (row) => enriched === undefined || row.enriched === enriched,
  );
  const page = matching.slice(offset, offset + limit);

  const suppliers: SupplierModuleService = req.scope.resolve(SUPPLIER_MODULE);
  const offers = page.length
    ? await suppliers.listSupplierOffers(
        { part_identifier_id: page.map(({ id }) => id) },
        { relations: ['supplier'], take: null },
      )
    : [];

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
        enriched: row.enriched,
        reasons: row.reasons,
        photos: row.photos,
        offers: storeOffers(
          offers.filter((offer) => offer.part_identifier_id === row.id),
        ).length,
        updated_by: row.updated_by,
        updated_at: row.updated_at.toISOString(),
      })),
    ),
    count: matching.length,
    counts: {
      enriched: judged.filter((row) => row.enriched).length,
      not_enriched: judged.filter((row) => !row.enriched).length,
    },
    offset,
    limit,
  });
}
