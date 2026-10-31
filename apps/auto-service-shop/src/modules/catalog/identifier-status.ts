import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import {
  attributeValuesSchema,
  normalizePartNumber,
} from '@podbor/catalog-contract';
import { z } from 'zod';

import { literalLike } from '../_shared/like';

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

export type IdentifierStatusFilters = {
  q?: string;
  category_id?: string;
  uncategorized?: boolean;
  part_id?: string;
  source_missing?: boolean;
};

export const identifierStatusRows = async (
  db: Knex,
  {
    q,
    category_id,
    uncategorized,
    part_id,
    source_missing,
  }: IdentifierStatusFilters,
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
