import { model } from '@medusajs/framework/utils';

import MakeSpelling from './make-spelling';
import { provenance } from './provenance';
import Series from './series';
import VehicleModel from './vehicle-model';

const Make = model
  .define('make', {
    id: model.id().primaryKey(),
    slug: model.text().unique(),
    name: model.text(),
    series: model.hasMany(() => Series, { mappedBy: 'make' }),
    models: model.hasMany(() => VehicleModel, { mappedBy: 'make' }),
    spellings: model.hasMany(() => MakeSpelling, { mappedBy: 'make' }),
    ...provenance(),
  })
  .cascades({ delete: ['spellings'] });

export default Make;
