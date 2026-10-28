import { model } from '@medusajs/framework/utils';

import Chassis from './chassis';
import { provenance } from './provenance';
import Vehicle from './vehicle';

const VehicleModel = model.define('vehicle_model', {
  id: model.id().primaryKey(),
  slug: model.text().unique(),
  name: model.text(),
  chassis: model.belongsTo(() => Chassis, { mappedBy: 'models' }),
  vehicles: model.hasMany(() => Vehicle, { mappedBy: 'model' }),
  ...provenance(),
});

export default VehicleModel;
