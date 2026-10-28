import { ModuleProvider, Modules } from '@medusajs/framework/utils';

import TypesenseSearchProviderService from './service';

export default ModuleProvider(Modules.SEARCH, {
  services: [TypesenseSearchProviderService],
});
