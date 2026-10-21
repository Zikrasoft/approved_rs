import { model } from '@medusajs/framework/utils';

import Supplier from './supplier';

const SupplierCategory = model
  .define('supplier_category', {
    id: model.id().primaryKey(),
    supplier: model.belongsTo(() => Supplier, { mappedBy: 'categories' }),
    code: model.text(),
    category_id: model.text().index(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ['supplier_id', 'code'], unique: true }]);

export default SupplierCategory;
