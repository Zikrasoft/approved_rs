import { model } from '@medusajs/framework/utils';
import { ENGINE_FUELS } from '@podbor/catalog-contract';

import { provenance } from './provenance';
import Vehicle from './vehicle';

const Engine = model.define('engine', {
  id: model.id().primaryKey(),
  code: model.text().unique(),
  family: model.text(),
  fuel: model.enum([...ENGINE_FUELS]),
  displacement_cc: model.number().nullable(),
  vehicles: model.hasMany(() => Vehicle, { mappedBy: 'engine' }),
  ...provenance(),
});

export default Engine;
