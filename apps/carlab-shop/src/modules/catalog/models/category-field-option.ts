import { model } from '@medusajs/framework/utils';

import CategoryField from './category-field';
import { provenance } from './provenance';

const CategoryFieldOption = model
  .define('category_field_option', {
    id: model.id().primaryKey(),
    key: model.text(),
    label: model.text(),
    translations: model.json().nullable(),
    rank: model.number().default(0),
    field: model.belongsTo(() => CategoryField, { mappedBy: 'options' }),
    ...provenance(),
  })
  .indexes([{ on: ['field_id', 'key'], unique: true }]);

export default CategoryFieldOption;
