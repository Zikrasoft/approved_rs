import { model } from '@medusajs/framework/utils';

import Chassis from './chassis';
import Make from './make';
import { provenance } from './provenance';
import { translatable } from './translatable';

const Series = model.define('series', {
  id: model.id().primaryKey(),
  name: model.text(),
  ...translatable(),
  make: model.belongsTo(() => Make, { mappedBy: 'series' }),
  chassis: model.hasMany(() => Chassis, { mappedBy: 'series' }),
  ...provenance(),
});

export default Series;
