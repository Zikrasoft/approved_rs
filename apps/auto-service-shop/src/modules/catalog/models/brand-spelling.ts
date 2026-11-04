import { model } from '@medusajs/framework/utils';

import Brand from './brand';
import { provenance } from './provenance';

const BrandSpelling = model
  .define('brand_spelling', {
    id: model.id().primaryKey(),
    supplier_id: model.text(),
    value: model.text(),
    value_key: model.text(),
    brand: model.belongsTo(() => Brand, { mappedBy: 'spellings' }),
    ...provenance(),
  })
  .indexes([
    {
      on: ['supplier_id', 'value'],
      unique: true,
    },
    {
      on: ['supplier_id', 'value_key'],
      unique: true,
    },
  ]);

export default BrandSpelling;
