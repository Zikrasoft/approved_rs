import { model } from '@medusajs/framework/utils';
import { CATEGORY_FIELD_TYPES } from '@podbor/catalog-contract';

import Category from './category';
import CategoryFieldOption from './category-field-option';
import { provenance } from './provenance';
import Requirement from './requirement';
import { translatable } from './translatable';

const CategoryField = model
  .define('category_field', {
    id: model.id().primaryKey(),
    key: model.text(),
    type: model.enum([...CATEGORY_FIELD_TYPES]),
    unit: model.text().nullable(),
    label: model.text(),
    ...translatable(),
    required: model.boolean().default(false),
    facet: model.boolean().default(false),
    rank: model.number().default(0),
    category: model.belongsTo(() => Category, { mappedBy: 'fields' }),
    options: model.hasMany(() => CategoryFieldOption, { mappedBy: 'field' }),
    requirements: model.hasMany(() => Requirement, { mappedBy: 'field' }),
    ...provenance(),
  })
  .cascades({ delete: ['options'] })
  .indexes([{ on: ['category_id', 'key'], unique: true }]);

export default CategoryField;
