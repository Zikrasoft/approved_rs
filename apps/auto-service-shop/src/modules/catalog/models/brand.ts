import { model } from '@medusajs/framework/utils';

import BrandSpelling from './brand-spelling';
import PartIdentifier from './part-identifier';
import { provenance } from './provenance';

const Brand = model
  .define('brand', {
    id: model.id().primaryKey(),
    name: model.text().unique(),
    slug: model.text().unique(),
    spellings: model.hasMany(() => BrandSpelling, { mappedBy: 'brand' }),
    identifiers: model.hasMany(() => PartIdentifier, { mappedBy: 'brand' }),
    ...provenance(),
  })
  .cascades({ delete: ['spellings'] });

export default Brand;
