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
  holders?: Holder[];
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
}: ReferenceEntity) => ({
  GET: async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const rows = z
      .array(editedRowSchema)
      .parse(
        await service(req, `list${plural}`)(
          {},
          { relations, order: { created_at: 'ASC' }, take: null },
        ),
      );
    res.json({ [collection]: await withEditors(req.scope, rows) });
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

export const MAKES: ReferenceEntity = {
  singular: 'Make',
  plural: 'Makes',
  object: 'make',
  collection: 'makes',
  relations: ['spellings'],
  holders: [{ plural: 'Series', entity: 'series', column: 'make_id' }],
};
export const SERIES: ReferenceEntity = {
  singular: 'Series',
  plural: 'Series',
  object: 'series',
  collection: 'series',
  holders: [{ plural: 'Chassis', entity: 'chassis', column: 'series_id' }],
};
export const CHASSIS: ReferenceEntity = {
  singular: 'Chassis',
  plural: 'Chassis',
  object: 'chassis',
  collection: 'chassis',
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
  holders: [{ ...VEHICLE_HOLDERS, column: 'model_id' }],
};
export const ENGINES: ReferenceEntity = {
  singular: 'Engine',
  plural: 'Engines',
  object: 'engine',
  collection: 'engines',
  holders: [{ ...VEHICLE_HOLDERS, column: 'engine_id' }],
};
export const VEHICLES: ReferenceEntity = {
  singular: 'Vehicle',
  plural: 'Vehicles',
  object: 'vehicle',
  collection: 'vehicles',
  relations: ['identifiers', 'model.chassis.series.make', 'engine'],
};
export const VEHICLE_IDENTIFIERS: ReferenceEntity = {
  singular: 'VehicleIdentifier',
  plural: 'VehicleIdentifiers',
  object: 'vehicle_identifier',
  collection: 'vehicle_identifiers',
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
