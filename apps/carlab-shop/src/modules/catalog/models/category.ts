import { model } from '@medusajs/framework/utils';

import CategoryField from './category-field';
import Part from './part';
import { provenance } from './provenance';
import { translatable } from './translatable';

const Category = model
  .define('category', {
    id: model.id().primaryKey(),
    slug: model.text().unique(),
    name: model.text(),
    text: model.text().default(''),
    ...translatable(),
    maintenance_kit: model.boolean().default(false),
    kit_rank: model.number().default(0),
    service_label: model.text().nullable(),
    service_price: model.number().nullable(),
    service_note: model.text().nullable(),
    fields: model.hasMany(() => CategoryField, { mappedBy: 'category' }),
    parts: model.hasMany(() => Part, { mappedBy: 'category' }),
    ...provenance(),
  })
  .cascades({ delete: ['fields'] });

export default Category;
