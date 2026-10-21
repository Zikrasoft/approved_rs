import { model } from '@medusajs/framework/utils';

import Supplier from './supplier';

const SupplierOffer = model.define('supplier_offer', {
  id: model.id().primaryKey(),
  supplier: model.belongsTo(() => Supplier, { mappedBy: 'offers' }),
  supplier_article_id: model.text(),
  cost_price: model.number(),
  stock_quantity: model.number(),
  lead_time: model.text(),
  part_identifier_id: model.text().index(),
});

export default SupplierOffer;
