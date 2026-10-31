import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { type TypeKey, typeKey } from '../../../../lib/vin/bmw-type-key';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';
import type { AdminListUnresolvedVinCodesType } from '../../validators';

const referenceOf = (make: string, code: string): TypeKey | null =>
  (make === 'bmw' && typeKey(code)) || null;

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListUnresolvedVinCodesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } =
    req.validatedQuery as AdminListUnresolvedVinCodesType;
  const { codes, count } = await req.scope
    .resolve<VinLookupModuleService>(VIN_LOOKUP_MODULE)
    .unresolvedCodes({ offset, limit });
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
