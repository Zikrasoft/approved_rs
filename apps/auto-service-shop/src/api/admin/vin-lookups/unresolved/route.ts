import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { parseEnv } from '../../../../lib/env';
import { openDataReference } from '../../../../lib/vin/open-data-reference';
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
  res.json({
    codes: codes.map((code) => ({
      ...code,
      reference: openDataReference(code.make, code.code),
    })),
    count,
    offset,
    limit,
  });
}
