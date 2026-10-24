import type { Context } from '@medusajs/framework/types';
import { MedusaService } from '@medusajs/framework/utils';

import { spellingKey } from '../../lib/suppliers/spelling';

import StagedRecord from './models/staged-record';
import Supplier from './models/supplier';
import SupplierCategory from './models/supplier-category';
import SupplierOffer from './models/supplier-offer';

const SupplierModuleBase = MedusaService({
  Supplier,
  SupplierOffer,
  SupplierCategory,
  StagedRecord,
});

type SupplierModuleBase = InstanceType<typeof SupplierModuleBase>;

type CodeInput = { code: string } & Record<string, unknown>;

const withCodeKey = (row: CodeInput) => ({
  ...row,
  code_key: spellingKey(row.code),
});

class SupplierModuleService extends SupplierModuleBase {
  override createSupplierCategories = ((
    data: CodeInput | CodeInput[],
    sharedContext?: Context,
  ) =>
    SupplierModuleBase.prototype.createSupplierCategories.call(
      this,
      Array.isArray(data) ? data.map(withCodeKey) : withCodeKey(data),
      sharedContext,
    )) as SupplierModuleBase['createSupplierCategories'];
}

export default SupplierModuleService;
