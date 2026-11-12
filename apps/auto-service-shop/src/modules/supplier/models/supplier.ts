import { model } from '@medusajs/framework/utils';
import { STAGED_DATA_KINDS } from '@podbor/catalog-contract';

import { SUPPLIER_KEYS } from '../keys';
import StagedRecord from './staged-record';
import SupplierCategory from './supplier-category';
import SupplierOffer from './supplier-offer';

const Supplier = model
  .define('supplier', {
    id: model.id().primaryKey(),
    key: model.enum([...SUPPLIER_KEYS]).unique(),
    name: model.text(),
    markup_percentage: model.float(),
    released_kinds: model.array().default([]),
    import_enabled: model.boolean().default(true),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
    offers: model.hasMany(() => SupplierOffer, { mappedBy: 'supplier' }),
    categories: model.hasMany(() => SupplierCategory, {
      mappedBy: 'supplier',
    }),
    staged_records: model.hasMany(() => StagedRecord, {
      mappedBy: 'supplier',
    }),
  })
  .cascades({ delete: ['offers', 'categories', 'staged_records'] })
  .checks([
    {
      name: 'supplier_markup_percentage',
      expression: 'markup_percentage >= 0',
    },
    {
      name: 'supplier_released_kinds',
      expression: `released_kinds <@ array[${STAGED_DATA_KINDS.map((kind) => `'${kind}'`).join(', ')}]::text[]`,
    },
  ]);

export default Supplier;
