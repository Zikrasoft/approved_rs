import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';

import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';

type UnresolvedCode = { make: string; code: string; count: number };

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const vinLookups: VinLookupModuleService =
    req.scope.resolve(VIN_LOOKUP_MODULE);

  // TODO: groups in memory; move to a GROUP BY query once unresolved lookups reach tens of thousands.
  const lookups = await vinLookups.listVinLookups(
    { vehicle_id: null, code: { $ne: null } },
    { select: ['make', 'code'], take: null },
  );

  const codes = new Map<string, UnresolvedCode>();
  for (const { make, code } of lookups) {
    const key = `${make}|${code}`;
    const entry = codes.get(key) ?? {
      make: String(make),
      code: String(code),
      count: 0,
    };
    entry.count += 1;
    codes.set(key, entry);
  }

  res.json({
    codes: [...codes.values()].sort(
      (a, b) =>
        b.count - a.count ||
        a.make.localeCompare(b.make) ||
        a.code.localeCompare(b.code),
    ),
  });
}
