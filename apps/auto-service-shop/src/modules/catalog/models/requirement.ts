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
    { name: 'requirement_quantity_positive', expression: 'quantity > 0' },
    { name: 'requirement_bounds_ordered', expression: 'min <= max' },
    {
      name: 'requirement_options_or_bounds',
      expression:
        '(coalesce(cardinality(option_keys), 0) > 0) <> (num_nonnulls(min, max) > 0)',
    },
  ]);

export default Requirement;
