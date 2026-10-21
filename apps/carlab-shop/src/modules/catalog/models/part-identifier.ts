import { model } from '@medusajs/framework/utils';
import { PART_IDENTIFIER_TYPES } from '@podbor/catalog-contract';

import Brand from './brand';
import Part from './part';
import { provenance } from './provenance';

export { PART_IDENTIFIER_TYPES };

const PartIdentifier = model
  .define('part_identifier', {
    id: model.id().primaryKey(),
    type: model.enum([...PART_IDENTIFIER_TYPES]),
    value: model.text(),
    normalized_value: model.text(),
    brand: model.belongsTo(() => Brand, { mappedBy: 'identifiers' }),
    part: model.belongsTo(() => Part, { mappedBy: 'identifiers' }),
    ...provenance(),
  })
  .indexes([
    {
      on: ['type', 'brand_id', 'normalized_value'],
      unique: true,
    },
  ]);

export default PartIdentifier;
