import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { parseEnv } from '../../../../lib/env';
import { isMakeOfKey } from '../../../../lib/vin/linkable';
import { openDataReference } from '../../../../lib/vin/open-data-reference';
import { slugOf } from '../../../../modules/_shared/slug';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';
import type { AdminListUnresolvedVinCodesType } from '../../validators';

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListUnresolvedVinCodesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit, all } =
    req.validatedQuery as AdminListUnresolvedVinCodesType;
  const { codes, count } = await req.scope
    .resolve<VinLookupModuleService>(VIN_LOOKUP_MODULE)
    .unresolvedCodes({
      offset,
      limit,
      all: all ?? false,
      staffVisitorIds: parseEnv(process.env).STAFF_VISITOR_IDS,
    });
  const makes = await req.scope
    .resolve<CatalogModuleService>(CATALOG_MODULE)
    .listMakes({}, { select: ['slug', 'name'], take: null });
  res.json({
    codes: codes.map((code) => ({
      ...code,
      make:
        makes.find((make) => isMakeOfKey(code.make_key, make))?.slug ??
        slugOf(code.make_key),
      reference: openDataReference(slugOf(code.make_key), code.code),
    })),
    count,
    offset,
    limit,
  });
}
