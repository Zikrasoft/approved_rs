import { model } from '@medusajs/framework/utils';

import Fitment from './fitment';
import PartIdentifier from './part-identifier';
import { provenance } from './provenance';
import { translatable } from './translatable';

const Part = model
  .define('part', {
    id: model.id().primaryKey(),
    name: model.text(),
    ...translatable(),
    identifiers: model.hasMany(() => PartIdentifier, { mappedBy: 'part' }),
    fitments: model.hasMany(() => Fitment, { mappedBy: 'part' }),
    ...provenance(),
  })
  .cascades({ delete: ['identifiers', 'fitments'] });

export default Part;
