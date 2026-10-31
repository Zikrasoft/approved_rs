import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  attributeValuesSchema,
  enrichmentGaps,
  normalizePartNumber,
} from '@podbor/catalog-contract';
import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import { z } from 'zod';

import { withEditors } from '../../../lib/editors';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { storeOffers } from '../../../modules/supplier/pricing';
import type SupplierModuleService from '../../../modules/supplier/service';
import type { AdminListPartIdentifiersType } from '../validators';
import { literalLike } from '../../../lib/like';

const statusRowSchema = z.object({
  id: z.string(),
  value: z.string(),
  normalized_value: z.string(),
  brand_id: z.string(),
  brand_name: z.string(),
  part_id: z.string(),
  part_name: z.string(),
  source_missing_since: z.date().nullable(),
  description: z.string().nullable(),
  category_id: z.string().nullable(),
  category_name: z.string().nullable(),
  attributes: attributeValuesSchema.nullable(),
  fitments: z.coerce.number(),
  equivalents: z.coerce.number(),
  photos: z.coerce.number(),
  updated_by: z.string().nullable(),
  updated_at: z.coerce.date(),
});

const statusRows = async (
  db: Knex,
  {
    q,
    category_id,
    uncategorized,
    part_id,
    source_missing,
  }: AdminListPartIdentifiersType,
) => {
  const query = db('part_identifier as pi')
    .join('part as p', 'p.id', 'pi.part_id')
    .join('brand as b', 'b.id', 'pi.brand_id')
    .leftJoin('category as c', (join) =>
      join.on('c.id', 'p.category_id').andOnNull('c.deleted_at'),
    )
    .whereNull('pi.deleted_at')
    .whereNull('p.deleted_at')
    .select(
      'pi.id',
      'pi.value',
      'pi.normalized_value',
      'b.id as brand_id',
      'b.name as brand_name',
      'p.id as part_id',
      'p.name as part_name',
      'p.source_missing_since',
      'p.description',
      'c.id as category_id',
      'c.name as category_name',
      'p.attributes',
      db.raw(
        `(select count(*) from fitment f join vehicle v on v.id = f.vehicle_id and v.deleted_at is null where f.part_id = p.id and f.deleted_at is null) as fitments`,
      ),
      db.raw(
        `(select count(*) from part_identifier s where s.part_id = p.id and s.id <> pi.id and s.deleted_at is null) as equivalents`,
      ),
      db.raw(`jsonb_array_length(pi.images -> 'items') as photos`),
      db.raw(
        `case when pi.updated_at > p.updated_at then pi.updated_by else p.updated_by end as updated_by`,
      ),
      db.raw('greatest(pi.updated_at, p.updated_at) as updated_at'),
    )
    .orderBy([
      { column: 'b.name' },
      { column: 'pi.normalized_value' },
      { column: 'pi.id' },
    ]);
  if (category_id) {
    query.where('p.category_id', category_id);
  }
  if (uncategorized) {
    query.whereNull('c.id');
  }
  if (part_id) {
    query.where('p.id', part_id);
  }
  if (source_missing) {
    query.whereNotNull('p.source_missing_since');
  }
  if (q) {
    const contains = `%${literalLike(q)}%`;
    const normalized = normalizePartNumber(q);
    query.where((where) => {
      where.whereILike('p.name', contains).orWhereILike('b.name', contains);
      if (normalized) {
        where.orWhereLike(
          'pi.normalized_value',
          `%${literalLike(normalized)}%`,
        );
      }
    });
  }
  return z.array(statusRowSchema).parse(await query);
};

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListPartIdentifiersType>,
  res: MedusaResponse,
): Promise<void> {
  const filters = req.validatedQuery as AdminListPartIdentifiersType;
  const { enriched, offset, limit } = filters;

  const rows = await statusRows(
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION),
    filters,
  );
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
