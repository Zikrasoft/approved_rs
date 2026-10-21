import { model } from '@medusajs/framework/utils';

import CategoryField from './category-field';
import Part from './part';
import { provenance } from './provenance';

const Category = model
  .define('category', {
    id: model.id().primaryKey(),
    slug: model.text().unique(),
    name: model.text(),
    text: model.text().default(''),
    translations: model.json().nullable(),
    fields: model.hasMany(() => CategoryField, { mappedBy: 'category' }),
    parts: model.hasMany(() => Part, { mappedBy: 'category' }),
    ...provenance(),
  })
  .cascades({ delete: ['fields'] });

export default Category;
