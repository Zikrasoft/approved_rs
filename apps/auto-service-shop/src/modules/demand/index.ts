import { Module } from '@medusajs/framework/utils';

import DemandModuleService from './service';

export const DEMAND_MODULE = 'demand';

export default Module(DEMAND_MODULE, {
  service: DemandModuleService,
});
