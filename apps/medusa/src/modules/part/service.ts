import { MedusaService } from '@medusajs/framework/utils';

import Part from './models/part';
import PartIdentifier from './models/part-identifier';
import Supplier from './models/supplier';
import SupplierOffer from './models/supplier-offer';

class PartModuleService extends MedusaService({
  Part,
  PartIdentifier,
  Supplier,
  SupplierOffer,
}) {}

export default PartModuleService;
