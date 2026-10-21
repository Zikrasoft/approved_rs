import { MedusaService } from '@medusajs/framework/utils';

import Chassis from './models/chassis';
import Engine from './models/engine';
import Fitment from './models/fitment';
import Make from './models/make';
import Part from './models/part';
import PartIdentifier from './models/part-identifier';
import Series from './models/series';
import Vehicle from './models/vehicle';
import VehicleIdentifier from './models/vehicle-identifier';
import VehicleModel from './models/vehicle-model';

class CatalogModuleService extends MedusaService({
  Make,
  Series,
  Chassis,
  VehicleModel,
  Engine,
  Part,
  PartIdentifier,
  Vehicle,
  VehicleIdentifier,
  Fitment,
}) {}

export default CatalogModuleService;
