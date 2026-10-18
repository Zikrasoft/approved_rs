import { model } from '@medusajs/framework/utils';

import PartIdentifier from './part-identifier';

const Part = model.define('part', {
  id: model.id().primaryKey(),
  name: model.text(),
  identifiers: model.hasMany(() => PartIdentifier, { mappedBy: 'part' }),
});

export default Part;
