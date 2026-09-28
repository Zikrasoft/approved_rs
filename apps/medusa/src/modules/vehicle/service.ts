import { MedusaService } from '@medusajs/framework/utils';

import { VehicleGeneration } from './models/vehicle-generation';
import { VehicleMake } from './models/vehicle-make';
import { VehicleModel } from './models/vehicle-model';

class VehicleModuleService extends MedusaService({
  VehicleMake,
  VehicleModel,
  VehicleGeneration,
}) {}

export default VehicleModuleService;
