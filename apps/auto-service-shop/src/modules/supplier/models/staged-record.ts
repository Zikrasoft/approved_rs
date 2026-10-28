import { model } from '@medusajs/framework/utils';
import { STAGED_DATA_KINDS } from '@podbor/catalog-contract';

import Supplier from './supplier';

const StagedRecord = model
  .define('staged_record', {
    id: model.id().primaryKey(),
    supplier: model.belongsTo(() => Supplier, { mappedBy: 'staged_records' }),
    part_identifier_id: model.text().index(),
    kind: model.enum([...STAGED_DATA_KINDS]),
    payload: model.json(),
  })
  .indexes([
    { on: ['supplier_id', 'part_identifier_id', 'kind'], unique: true },
  ]);

export default StagedRecord;
