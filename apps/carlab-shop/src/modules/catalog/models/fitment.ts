import { model } from '@medusajs/framework/utils';
import {
  FITMENT_AXLES,
  FITMENT_SIDES,
  GEARBOX_TYPES,
  STEERING_SIDES,
} from '@podbor/catalog-contract';

import Part from './part';
import { provenance } from './provenance';
import { translatable } from './translatable';
import Vehicle from './vehicle';

const Fitment = model.define('fitment', {
  id: model.id().primaryKey(),
  part: model.belongsTo(() => Part, { mappedBy: 'fitments' }),
  vehicle: model.belongsTo(() => Vehicle, { mappedBy: 'fitments' }),
  quantity: model.number().default(1),
  axle: model.enum([...FITMENT_AXLES]).nullable(),
  side: model.enum([...FITMENT_SIDES]).nullable(),
  production_from: model.dateTime().nullable(),
  production_to: model.dateTime().nullable(),
  steering: model.enum([...STEERING_SIDES]).nullable(),
  gearbox: model.enum([...GEARBOX_TYPES]).nullable(),
  note: model.text().nullable(),
  ...translatable(),
  ...provenance(),
});

export default Fitment;
