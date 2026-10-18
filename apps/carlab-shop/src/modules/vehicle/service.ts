import { MedusaService } from '@medusajs/framework/utils';

import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import Fitment from './models/fitment';

class VehicleModuleService extends MedusaService({
  Vehicle,
  VehicleIdentifier,
  Fitment,
}) {}

export default VehicleModuleService;
