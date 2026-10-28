import { model } from '@medusajs/framework/utils';

import CategoryField from './category-field';
import Chassis from './chassis';
import Engine from './engine';
import { provenance } from './provenance';
import Vehicle from './vehicle';

const Requirement = model
  .define('requirement', {
    id: model.id().primaryKey(),
    field: model.belongsTo(() => CategoryField, { mappedBy: 'requirements' }),
    engine: model
      .belongsTo(() => Engine, { mappedBy: 'requirements' })
      .nullable(),
    chassis: model
      .belongsTo(() => Chassis, { mappedBy: 'requirements' })
      .nullable(),
    vehicle: model
      .belongsTo(() => Vehicle, { mappedBy: 'requirements' })
      .nullable(),
    option_keys: model.array().nullable(),
    min: model.float().nullable(),
    max: model.float().nullable(),
    quantity: model.number().default(1),
    ...provenance(),
  })
  .checks([
    {
      name: 'requirement_one_target',
      expression: 'num_nonnulls(engine_id, chassis_id, vehicle_id) = 1',
    },
  ]);

export default Requirement;
