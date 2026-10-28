import { model } from '@medusajs/framework/utils';

import MakeSpelling from './make-spelling';
import { provenance } from './provenance';
import Series from './series';

const Make = model
  .define('make', {
    id: model.id().primaryKey(),
    slug: model.text().unique(),
    name: model.text(),
    series: model.hasMany(() => Series, { mappedBy: 'make' }),
    spellings: model.hasMany(() => MakeSpelling, { mappedBy: 'make' }),
    ...provenance(),
  })
  .cascades({ delete: ['spellings'] });

export default Make;
