import { model } from '@medusajs/framework/utils';

import Chassis from './chassis';
import Make from './make';
import { provenance } from './provenance';
import Vehicle from './vehicle';

const VehicleModel = model
  .define('vehicle_model', {
    id: model.id().primaryKey(),
    slug: model.text(),
    name: model.text(),
    make: model.belongsTo(() => Make, { mappedBy: 'models' }),
    chassis: model.belongsTo(() => Chassis, { mappedBy: 'models' }),
    vehicles: model.hasMany(() => Vehicle, { mappedBy: 'model' }),
    ...provenance(),
  })
  .indexes([{ on: ['make_id', 'slug'], unique: true }]);

export default VehicleModel;
