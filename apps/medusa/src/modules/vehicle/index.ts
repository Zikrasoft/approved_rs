import { Module } from '@medusajs/framework/utils';

import { VEHICLE_MODULE } from './id';
import VehicleModuleService from './service';

export default Module(VEHICLE_MODULE, { service: VehicleModuleService });
