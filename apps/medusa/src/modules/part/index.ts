import { Module } from '@medusajs/framework/utils';

import PartModuleService from './service';

export const PART_MODULE = 'part';

export default Module(PART_MODULE, {
  service: PartModuleService,
});
