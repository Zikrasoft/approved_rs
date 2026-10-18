import { model } from '@medusajs/framework/utils';

import Part from './part';
import SupplierOffer from './supplier-offer';

export const PART_IDENTIFIER_TYPES = [
  'oem',
  'manufacturer-number',
  'ean',
] as const;

const PartIdentifier = model
  .define('part_identifier', {
    id: model.id().primaryKey(),
    type: model.enum([...PART_IDENTIFIER_TYPES]),
    brand: model.text(),
    value: model.text(),
    part: model.belongsTo(() => Part, { mappedBy: 'identifiers' }),
    offers: model.hasMany(() => SupplierOffer, { mappedBy: 'identifier' }),
  })
  .indexes([
    {
      on: ['type', 'brand', 'value'],
      unique: true,
    },
  ]);

export default PartIdentifier;
