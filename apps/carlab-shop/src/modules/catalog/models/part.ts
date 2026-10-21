import { model } from '@medusajs/framework/utils';

import Fitment from './fitment';
import PartIdentifier from './part-identifier';
import { provenance } from './provenance';

const Part = model
  .define('part', {
    id: model.id().primaryKey(),
    name: model.text(),
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
