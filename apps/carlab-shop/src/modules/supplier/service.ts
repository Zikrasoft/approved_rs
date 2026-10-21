import { MedusaService } from '@medusajs/framework/utils';

import Supplier from './models/supplier';
import SupplierOffer from './models/supplier-offer';

class SupplierModuleService extends MedusaService({
  Supplier,
  SupplierOffer,
}) {}

export default SupplierModuleService;
