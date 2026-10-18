import { MedusaService } from '@medusajs/framework/utils';

import VinLookup from './models/vin-lookup';

class VinLookupModuleService extends MedusaService({
  VinLookup,
}) {}

export default VinLookupModuleService;
