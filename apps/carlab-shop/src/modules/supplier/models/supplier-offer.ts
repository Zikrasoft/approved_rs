import { model } from '@medusajs/framework/utils';

import Supplier from './supplier';

const SupplierOffer = model
  .define('supplier_offer', {
    id: model.id().primaryKey(),
    supplier: model.belongsTo(() => Supplier, { mappedBy: 'offers' }),
    supplier_article_id: model.text(),
    cost_price: model.number(),
    currency: model.text().default('RSD'),
    stock_quantity: model.number(),
    stock_by_location: model.json().default({}),
    lead_time_days: model.number(),
    part_identifier_id: model.text().index(),
    created_by: model.text().nullable(),
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ['supplier_id', 'supplier_article_id'], unique: true }]);

export default SupplierOffer;
