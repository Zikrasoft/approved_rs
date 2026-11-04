import { Module } from '@medusajs/framework/utils';

import VinLookupModuleService from './service';

export const VIN_LOOKUP_MODULE = 'vin_lookup';

export default Module(VIN_LOOKUP_MODULE, {
  service: VinLookupModuleService,
});
