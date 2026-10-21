import { model } from '@medusajs/framework/utils';
import { BODY_STYLES } from '@podbor/catalog-contract';

import { provenance } from './provenance';
import Requirement from './requirement';
import Series from './series';
import VehicleModel from './vehicle-model';

const Chassis = model
  .define('chassis', {
    id: model.id().primaryKey(),
    code: model.text().unique(),
    body_style: model.enum([...BODY_STYLES]),
    year_from: model.number().nullable(),
    year_to: model.number().nullable(),
    series: model.belongsTo(() => Series, { mappedBy: 'chassis' }),
    models: model.hasMany(() => VehicleModel, { mappedBy: 'chassis' }),
    requirements: model.hasMany(() => Requirement, { mappedBy: 'chassis' }),
    ...provenance(),
  })
  .cascades({ delete: ['requirements'] });

export default Chassis;
