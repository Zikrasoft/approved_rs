import { model } from '@medusajs/framework/utils';

import SupplierOffer from './supplier-offer';

const Supplier = model.define('supplier', {
  id: model.id().primaryKey(),
  name: model.text().unique(),
  markup_percentage: model.number(),
  offers: model.hasMany(() => SupplierOffer, { mappedBy: 'supplier' }),
});

export default Supplier;
