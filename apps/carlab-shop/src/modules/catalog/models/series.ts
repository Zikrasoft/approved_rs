import { model } from '@medusajs/framework/utils';

import Chassis from './chassis';
import Make from './make';
import { provenance } from './provenance';

const Series = model.define('series', {
  id: model.id().primaryKey(),
  name: model.text(),
  translations: model.json().nullable(),
  translated_from: model.text().nullable(),
  make: model.belongsTo(() => Make, { mappedBy: 'series' }),
  chassis: model.hasMany(() => Chassis, { mappedBy: 'series' }),
  ...provenance(),
});

export default Series;
