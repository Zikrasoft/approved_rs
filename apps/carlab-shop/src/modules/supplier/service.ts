import { MedusaService } from '@medusajs/framework/utils';

import StagedRecord from './models/staged-record';
import Supplier from './models/supplier';
import SupplierCategory from './models/supplier-category';
import SupplierOffer from './models/supplier-offer';

class SupplierModuleService extends MedusaService({
  Supplier,
  SupplierOffer,
  SupplierCategory,
  StagedRecord,
}) {}

export default SupplierModuleService;
