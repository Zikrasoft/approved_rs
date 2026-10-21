import { MedusaService } from '@medusajs/framework/utils';

import Fitment from './models/fitment';
import Part from './models/part';
import PartIdentifier from './models/part-identifier';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';

class CatalogModuleService extends MedusaService({
  Part,
  PartIdentifier,
  Vehicle,
  VehicleIdentifier,
  Fitment,
}) {}

export default CatalogModuleService;
