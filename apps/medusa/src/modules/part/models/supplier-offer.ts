import { model } from '@medusajs/framework/utils';

import PartIdentifier from './part-identifier';

const SupplierOffer = model.define('supplier_offer', {
  id: model.id().primaryKey(),
  supplier: model.text(),
  supplier_article_id: model.text(),
  // TODO: plain number until the markup/currency work (ticket #349)
  // introduces real money handling; this is the seeded sell price.
  price: model.number(),
  stock_quantity: model.number(),
  lead_time: model.text(),
  identifier: model.belongsTo(() => PartIdentifier, { mappedBy: 'offers' }),
});

export default SupplierOffer;
