import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { parseEnv } from '../../../../lib/env';
import { typeKey } from '../../../../lib/vin/bmw-type-key';
import { vagReference } from '../../../../lib/vin/vag-model-codes';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';
import type { AdminListUnresolvedVinCodesType } from '../../validators';

const referenceOf = (make: string, code: string) =>
  (make === 'bmw' && typeKey(code)) || vagReference(make, code);

// TODO: carlab.rs sends no visitor id yet (it lives in localStorage, the VIN search is server-rendered); once it does, show a code's visitor ids so staff can find the Lead in the CRM
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
      reference: referenceOf(code.make, code.code),
    })),
    count,
    offset,
    limit,
  });
}
