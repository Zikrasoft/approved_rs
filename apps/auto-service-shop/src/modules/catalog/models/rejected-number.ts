import { model } from '@medusajs/framework/utils';

import { provenance } from './provenance';

const RejectedNumber = model
  .define('rejected_number', {
    id: model.id().primaryKey(),
    brand_id: model.text(),
    normalized_value: model.text(),
    ...provenance(),
  })
  .indexes([{ on: ['brand_id', 'normalized_value'], unique: true }])
  .checks([
    {
      name: 'rejected_number_normalized_value_key',
      expression: "normalized_value SIMILAR TO '[A-Z0-9]+'",
    },
  ]);

export default RejectedNumber;
