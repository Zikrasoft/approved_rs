import { model } from '@medusajs/framework/utils';

import Category from './category';
import Fitment from './fitment';
import PartIdentifier from './part-identifier';
import { provenance } from './provenance';
import { translatable } from './translatable';

const Part = model
  .define('part', {
    id: model.id().primaryKey(),
    name: model.text(),
    category: model.belongsTo(() => Category, { mappedBy: 'parts' }).nullable(),
    attributes: model.json().default({}),
    images: model.json().default({ items: [] }),
    ...translatable(),
    identifiers: model.hasMany(() => PartIdentifier, { mappedBy: 'part' }),
    fitments: model.hasMany(() => Fitment, { mappedBy: 'part' }),
    replaced_by: model
      .belongsTo(() => Part, { mappedBy: 'replaces' })
      .nullable(),
    replaces: model.hasMany(() => Part, { mappedBy: 'replaced_by' }),
    ...provenance(),
  })
  .cascades({ delete: ['identifiers', 'fitments'] });

export default Part;
