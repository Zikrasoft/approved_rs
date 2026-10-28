import { model } from '@medusajs/framework/utils';

import Make from './make';
import { provenance } from './provenance';

const MakeSpelling = model
  .define('make_spelling', {
    id: model.id().primaryKey(),
    supplier_id: model.text(),
    value: model.text(),
    value_key: model.text(),
    make: model.belongsTo(() => Make, { mappedBy: 'spellings' }),
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

export default MakeSpelling;
