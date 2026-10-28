import { defineLink } from '@medusajs/framework/utils';

import CatalogModule from '../modules/catalog';
import SupplierModule from '../modules/supplier';

export default defineLink(
  { linkable: CatalogModule.linkable.partIdentifier, field: 'id' },
  {
    ...SupplierModule.linkable.supplierOffer.id,
    primaryKey: 'part_identifier_id',
    alias: 'offer',
  },
  { readOnly: true, isList: true },
);
