import { model } from '@medusajs/framework/utils';

import { VIN_LOOKUP_SOURCES } from '../../../lib/vin/sources';
import VinLookup from './vin-lookup';

const VinLookupHit = model
  .define('vin_lookup_hit', {
    id: model.id().primaryKey(),
    vin_lookup: model.belongsTo(() => VinLookup, { mappedBy: 'hits' }),
    source: model.enum([...VIN_LOOKUP_SOURCES]),
    bot: model.boolean().nullable(),
    visitor_id: model.text().nullable(),
  })
  .indexes([{ on: ['visitor_id'], where: { visitor_id: { $ne: null } } }]);

export default VinLookupHit;
