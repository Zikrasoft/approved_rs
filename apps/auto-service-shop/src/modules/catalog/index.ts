import { Module } from '@medusajs/framework/utils';

import CatalogModuleService from './service';

export const CATALOG_MODULE = 'catalog';

export { MANUAL_SOURCE, WORKSHOP_QUOTE_SOURCE } from './models/provenance';

export default Module(CATALOG_MODULE, {
  service: CatalogModuleService,
});
