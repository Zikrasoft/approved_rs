import { Module } from '@medusajs/framework/utils';

import PublishModuleService from './service';

export const PUBLISH_MODULE = 'publish';

export default Module(PUBLISH_MODULE, {
  service: PublishModuleService,
});
