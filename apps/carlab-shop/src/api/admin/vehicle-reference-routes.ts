import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../modules/catalog';

type ReferenceEntity = {
  singular: string;
  plural: string;
  object: string;
  collection: string;
  relations?: string[];
};

type Method = (...args: unknown[]) => Promise<unknown>;

const service = (req: AuthenticatedMedusaRequest, name: string): Method => {
  const catalog = req.scope.resolve<Record<string, Method>>(CATALOG_MODULE);
  return catalog[name].bind(catalog);
};

export const collectionRoutes = ({
  plural,
  object,
  collection,
  relations = [],
}: ReferenceEntity) => ({
  GET: async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const rows = await service(req, `list${plural}`)(
      {},
      { relations, order: { created_at: 'ASC' } },
    );
    res.json({ [collection]: rows });
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
      created_by: req.auth_context.actor_id,
      updated_by: req.auth_context.actor_id,
    });
    res.json({ [object]: row });
  },
});

export const itemRoutes = ({ singular, plural, object }: ReferenceEntity) => ({
  POST: async (
    req: AuthenticatedMedusaRequest<Record<string, unknown>>,
    res: MedusaResponse,
  ) => {
    const { id } = req.params;
    await service(req, `retrieve${singular}`)(id);
    const row = await service(
      req,
      `update${plural}`,
    )({
      ...req.validatedBody,
      id,
      updated_by: req.auth_context.actor_id,
    });
    res.json({ [object]: row });
  },
  DELETE: async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
    const { id } = req.params;
    await service(req, `retrieve${singular}`)(id);
    try {
      await service(req, `delete${plural}`)(id);
    } catch (error) {
      if (
        MedusaError.isMedusaError(error) &&
        error.type === MedusaError.Types.NOT_FOUND
      ) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          `This ${object.replace('_', ' ')} is still in use and cannot be deleted.`,
        );
      }
      throw error;
    }
    res.json({ id, object, deleted: true });
  },
});

export const MAKES = {
  singular: 'Make',
  plural: 'Makes',
  object: 'make',
  collection: 'makes',
};
export const SERIES = {
  singular: 'Series',
  plural: 'Series',
  object: 'series',
  collection: 'series',
};
export const CHASSIS = {
  singular: 'Chassis',
  plural: 'Chassis',
  object: 'chassis',
  collection: 'chassis',
};
export const VEHICLE_MODELS = {
  singular: 'VehicleModel',
  plural: 'VehicleModels',
  object: 'vehicle_model',
  collection: 'vehicle_models',
};
export const ENGINES = {
  singular: 'Engine',
  plural: 'Engines',
  object: 'engine',
  collection: 'engines',
};
export const VEHICLES = {
  singular: 'Vehicle',
  plural: 'Vehicles',
  object: 'vehicle',
  collection: 'vehicles',
  relations: ['identifiers', 'model', 'engine'],
};
export const VEHICLE_IDENTIFIERS = {
  singular: 'VehicleIdentifier',
  plural: 'VehicleIdentifiers',
  object: 'vehicle_identifier',
  collection: 'vehicle_identifiers',
};
