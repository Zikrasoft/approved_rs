import type { Logger, MedusaContainer } from '@medusajs/framework/types';

import { loadVehicleTree } from '../lib/vehicles';
import { VEHICLE_MODULE } from '../modules/vehicle/id';
import type VehicleModuleService from '../modules/vehicle/service';
import { VEHICLES } from './vehicle-fixture';

const named = <T extends { name: string }>(
  nodes: readonly T[] | undefined,
  name: string,
): T | undefined => nodes?.find((node) => node.name === name);

export async function seedVehicles(
  container: MedusaContainer,
  logger: Logger,
): Promise<void> {
  const service = container.resolve<VehicleModuleService>(VEHICLE_MODULE);

  let tree = await loadVehicleTree(container);
  const makes = VEHICLES.filter((make) => !named(tree, make.name)).map(
    (make) => ({ name: make.name }),
  );
  if (makes.length) {
    await service.createVehicleMakes(makes);
    tree = await loadVehicleTree(container);
  }

  const models = VEHICLES.flatMap((make) => {
    const stored = named(tree, make.name);
    if (!stored?.id) {
      return [];
    }
    const makeId = stored.id;
    return make.models
      .filter((model) => !named(stored.models, model.name))
      .map((model) => ({ name: model.name, make_id: makeId }));
  });
  if (models.length) {
    await service.createVehicleModels(models);
    tree = await loadVehicleTree(container);
  }

  const generations = VEHICLES.flatMap((make) =>
    make.models.flatMap((model) => {
      const stored = named(named(tree, make.name)?.models, model.name);
      if (!stored?.id) {
        return [];
      }
      const modelId = stored.id;
      return model.generations
        .filter((generation) => !named(stored.generations, generation.name))
        .map((generation) => ({
          name: generation.name,
          year_from: generation.yearFrom,
          year_to: generation.yearTo,
          vehicle_model_id: modelId,
        }));
    }),
  );
  if (generations.length) {
    await service.createVehicleGenerations(generations);
  }

  if (makes.length || models.length || generations.length) {
    logger.info(
      `Vehicle dictionary: added ${makes.length} makes, ${models.length} models, ${generations.length} generations`,
    );
  }
}
