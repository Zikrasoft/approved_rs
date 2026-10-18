import { Module } from '@medusajs/framework/utils';

import VehicleModuleService from './service';

export const VEHICLE_MODULE = 'vehicle';

export default Module(VEHICLE_MODULE, {
  service: VehicleModuleService,
});
