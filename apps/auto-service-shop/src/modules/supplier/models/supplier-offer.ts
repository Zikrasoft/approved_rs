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
  .indexes([{ on: ['supplier_id', 'supplier_article_id'], unique: true }])
  .checks([
    { name: 'supplier_offer_cost_price', expression: 'cost_price >= 0' },
    { name: 'supplier_offer_stock', expression: 'stock_quantity >= 0' },
    { name: 'supplier_offer_lead_time', expression: 'lead_time_days >= 0' },
    {
      name: 'supplier_offer_currency',
      expression: "currency similar to '[A-Z]{3}'",
    },
  ]);

export default SupplierOffer;
