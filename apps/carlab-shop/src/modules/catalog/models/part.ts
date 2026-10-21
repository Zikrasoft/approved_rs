import { model } from '@medusajs/framework/utils';

import Category from './category';
import Fitment from './fitment';
import PartIdentifier from './part-identifier';
import { provenance } from './provenance';

const Part = model
  .define('part', {
    id: model.id().primaryKey(),
    name: model.text(),
    category: model.belongsTo(() => Category, { mappedBy: 'parts' }).nullable(),
    attributes: model.json().default({}),
    identifiers: model.hasMany(() => PartIdentifier, { mappedBy: 'part' }),
    fitments: model.hasMany(() => Fitment, { mappedBy: 'part' }),
    ...provenance(),
  })
  .cascades({ delete: ['identifiers', 'fitments'] });

export default Part;
