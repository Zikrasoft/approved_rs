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

// TODO: once every deployed image reads notes through note_id, link the last unlinked notes, drop fitment.note, translations, translated_from and IDX_fitment_unlinked_note in the next deploy, then VACUUM FULL fitment.
const Fitment = model
  .define('fitment', {
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
    note_id: model.text().nullable(),
    ...translatable(),
    ...provenance(),
  })
  .checks([
    {
      name: 'fitment_production_ordered',
      expression: 'production_from <= production_to',
    },
    { name: 'fitment_quantity_positive', expression: 'quantity > 0' },
  ])
  .indexes([{ on: ['source'] }]);

export default Fitment;
