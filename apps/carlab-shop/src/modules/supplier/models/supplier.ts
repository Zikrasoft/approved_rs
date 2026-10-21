import { model } from '@medusajs/framework/utils';

import StagedRecord from './staged-record';
import SupplierCategory from './supplier-category';
import SupplierOffer from './supplier-offer';

const Supplier = model
  .define('supplier', {
    id: model.id().primaryKey(),
    name: model.text().unique(),
    markup_percentage: model.number(),
    released_kinds: model.array().default([]),
    offers: model.hasMany(() => SupplierOffer, { mappedBy: 'supplier' }),
    categories: model.hasMany(() => SupplierCategory, {
      mappedBy: 'supplier',
    }),
    staged_records: model.hasMany(() => StagedRecord, {
      mappedBy: 'supplier',
    }),
  })
  .cascades({ delete: ['offers', 'categories', 'staged_records'] });

export default Supplier;
