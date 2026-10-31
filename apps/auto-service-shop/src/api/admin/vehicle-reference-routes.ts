import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { z } from 'zod';

import { CATALOG_MODULE } from '../../modules/catalog';
import type CatalogModuleService from '../../modules/catalog/service';
import { adminError, parseAdminBody } from '../../lib/admin-errors';
import { createdBy, updatedBy, withEditors } from '../../lib/editors';
import { literalLike } from '../../lib/like';
import { STORED_ROW_RULES } from './vehicle-validators';

const editedRowSchema = z.object({ updated_by: z.string().nullable() }).loose();

type Method = {
  bivariant(...args: unknown[]): Promise<unknown>;
}['bivariant'];

type CatalogMethod = {
  [Key in keyof CatalogModuleService]: CatalogModuleService[Key] extends Method
    ? Key
    : never;
}[keyof CatalogModuleService];

type Plural = {
  [Key in CatalogMethod]: Key extends `listAndCount${infer Name}`
    ? `create${Name}` | `update${Name}` | `delete${Name}` extends CatalogMethod
      ? Name
      : never
    : never;
}[CatalogMethod];

type Singular = {
  [Key in CatalogMethod]: Key extends `retrieve${infer Name}` ? Name : never;
}[CatalogMethod];

type Holder = { plural: Plural; entity: string; column: string };

type ReferenceEntity = {
  singular: Singular;
  plural: Plural;
  object: string;
  collection: string;
  relations?: string[];
  searched: string[];
  holders?: Holder[];
};

const listQuerySchema = z.object({
  q: z.string().trim().max(200).default(''),
  id: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => [value].flat())
    .pipe(z.array(z.string().min(1)).max(200))
    .optional(),
  offset: z.coerce.number().int().nonnegative().max(1_000_000).default(0),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

const nested = (path: string, condition: object): object =>
  path
    .split('.')
    .reduceRight<object>((inner, key) => ({ [key]: inner }), condition);

const searchFilter = (searched: string[], q: string) => {
  const words = q.split(/\s+/).filter(Boolean);
  return words.length
    ? {
        $and: words.map((word) => ({
          $or: searched.map((path) =>
            nested(path, { $ilike: `%${literalLike(word)}%` }),
          ),
        })),
      }
    : {};
};

const service = (
  req: AuthenticatedMedusaRequest,
  name: CatalogMethod,
): Method => {
  const catalog = req.scope.resolve<CatalogModuleService>(CATALOG_MODULE);
  const method: Method = catalog[name];
  return method.bind(catalog);
};

export const collectionRoutes = ({
  plural,
  object,
  collection,
  relations = [],
  searched,
}: ReferenceEntity) => ({
  GET: async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const query = listQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        z.prettifyError(query.error),
      );
    }
    const { q, id, offset, limit } = query.data;
    const [rows, count] = z.tuple([z.array(editedRowSchema), z.number()]).parse(
      await service(req, `listAndCount${plural}`)(
        { ...searchFilter(searched, q), ...(id && { id }) },
        {
          relations,
          order: { created_at: 'ASC', id: 'ASC' },
          skip: offset,
          take: limit,
        },
      ),
    );
    res.json({ [collection]: await withEditors(req.scope, rows), count });
  },
  POST: async (
    req: AuthenticatedMedusaRequest<Record<string, unknown>>,
    res: MedusaResponse,
  ) => {
    const row = await service(
      req,
      `create${plural}`,
    )({
      ...req.validatedBody,
      ...createdBy(req),
    });
    res.json({ [object]: row });
  },
});

const countHolders = async (
  req: AuthenticatedMedusaRequest,
  id: string,
  holders: Holder[],
) =>
  (
    await Promise.all(
      holders.map(async ({ plural, entity, column }) => {
        const [, count] = z
          .tuple([z.array(z.unknown()), z.number()])
          .parse(
            await service(req, `listAndCount${plural}`)(
              { [column]: id },
              { select: ['id'], take: 1 },
            ),
          );
        return { entity, count };
      }),
    )
  ).filter(({ count }) => count > 0);

export const itemRoutes = ({
  singular,
  plural,
  object,
  holders,
}: ReferenceEntity) => ({
  POST: async (
    req: AuthenticatedMedusaRequest<Record<string, unknown>>,
    res: MedusaResponse,
  ) => {
    const { id } = req.params;
    const stored = await service(req, `retrieve${singular}`)(id);
    const rule = STORED_ROW_RULES[object];
    if (rule) {
      await parseAdminBody(rule, {
        ...(stored as object),
        ...req.validatedBody,
      });
    }
    const row = await service(
      req,
      `update${plural}`,
    )({
      ...req.validatedBody,
      id,
      ...updatedBy(req),
    });
    res.json({ [object]: row });
  },
  DELETE: async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const { id } = req.params;
    await deleteUnlessHeld(req, { singular, plural, object, holders }, id);
    res.json({ id, object, deleted: true });
  },
});

export const deleteUnlessHeld = async (
  req: AuthenticatedMedusaRequest,
  {
    singular,
    plural,
    object,
    holders = [],
  }: Pick<ReferenceEntity, 'singular' | 'plural' | 'object' | 'holders'>,
  id: string,
) => {
  await service(req, `retrieve${singular}`)(id);
  const held = await countHolders(req, id, holders);
  if (held.length) {
    throw adminError(
      MedusaError.Types.CONFLICT,
      'IN_USE',
      `This ${object.replace('_', ' ')} is still in use and cannot be deleted.`,
      { holders: held },
    );
  }
  await service(req, `delete${plural}`)(id);
};

const VEHICLE_HOLDERS = { plural: 'Vehicles', entity: 'vehicle' } as const;

const VEHICLE_SEARCH = [
  'model.name',
  'model.chassis.code',
  'model.chassis.series.name',
  'model.chassis.series.make.name',
  'model.chassis.series.make.slug',
  'engine.code',
];

export const MAKES: ReferenceEntity = {
  singular: 'Make',
  plural: 'Makes',
  object: 'make',
  collection: 'makes',
  relations: ['spellings'],
  searched: ['name', 'slug'],
  holders: [{ plural: 'Series', entity: 'series', column: 'make_id' }],
};
export const SERIES: ReferenceEntity = {
  singular: 'Series',
  plural: 'Series',
  object: 'series',
  collection: 'series',
  relations: ['make'],
  searched: ['name', 'make.name'],
  holders: [{ plural: 'Chassis', entity: 'chassis', column: 'series_id' }],
};
export const CHASSIS: ReferenceEntity = {
  singular: 'Chassis',
  plural: 'Chassis',
  object: 'chassis',
  collection: 'chassis',
  relations: ['series.make'],
  searched: ['code', 'series.name', 'series.make.name'],
  holders: [
    {
      plural: 'VehicleModels',
      entity: 'vehicle_model',
      column: 'chassis_id',
    },
  ],
};
export const VEHICLE_MODELS: ReferenceEntity = {
  singular: 'VehicleModel',
  plural: 'VehicleModels',
  object: 'vehicle_model',
  collection: 'vehicle_models',
  relations: ['chassis.series.make'],
  searched: [
    'name',
    'slug',
    'chassis.code',
    'chassis.series.name',
    'chassis.series.make.name',
  ],
  holders: [{ ...VEHICLE_HOLDERS, column: 'model_id' }],
};
export const ENGINES: ReferenceEntity = {
  singular: 'Engine',
  plural: 'Engines',
  object: 'engine',
  collection: 'engines',
  searched: ['code', 'family'],
  holders: [{ ...VEHICLE_HOLDERS, column: 'engine_id' }],
};
export const VEHICLES: ReferenceEntity = {
  singular: 'Vehicle',
  plural: 'Vehicles',
  object: 'vehicle',
  collection: 'vehicles',
  relations: ['identifiers', 'model.chassis.series.make', 'engine'],
  searched: [...VEHICLE_SEARCH, 'identifiers.value'],
};
export const VEHICLE_IDENTIFIERS: ReferenceEntity = {
  singular: 'VehicleIdentifier',
  plural: 'VehicleIdentifiers',
  object: 'vehicle_identifier',
  collection: 'vehicle_identifiers',
  relations: ['vehicle.model.chassis.series.make', 'vehicle.engine'],
  searched: ['value', ...VEHICLE_SEARCH.map((path) => `vehicle.${path}`)],
};
export const BRANDS: Pick<
  ReferenceEntity,
  'singular' | 'plural' | 'object' | 'holders'
> = {
  singular: 'Brand',
  plural: 'Brands',
  object: 'brand',
  holders: [
    {
      plural: 'PartIdentifiers',
      entity: 'part_identifier',
      column: 'brand_id',
    },
  ],
};
export const CATEGORIES: Pick<
  ReferenceEntity,
  'singular' | 'plural' | 'object' | 'holders'
> = {
  singular: 'Category',
  plural: 'Categories',
  object: 'category',
  holders: [{ plural: 'Parts', entity: 'part', column: 'category_id' }],
};
