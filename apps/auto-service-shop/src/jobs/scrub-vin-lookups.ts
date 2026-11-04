import type { MedusaContainer } from '@medusajs/framework/types';

import { VIN_LOOKUP_MODULE } from '../modules/vin-lookup';
import type VinLookupModuleService from '../modules/vin-lookup/service';

export const VIN_KEPT_FOR_DAYS = 90;
const DAY_MS = 86_400_000;

export const scrubVinLookupsAt = (
  container: MedusaContainer,
  now: Date,
): Promise<number> =>
  container
    .resolve<VinLookupModuleService>(VIN_LOOKUP_MODULE)
    .scrubLookupsBefore(new Date(now.getTime() - VIN_KEPT_FOR_DAYS * DAY_MS));

export default async function scrubVinLookups(container: MedusaContainer) {
  await scrubVinLookupsAt(container, new Date());
}

export const config = {
  name: 'scrub-vin-lookups',
  schedule: '40 3 * * *',
};
