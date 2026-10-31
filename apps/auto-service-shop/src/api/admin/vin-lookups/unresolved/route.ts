import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';

import { type TypeKey, typeKey } from '../../../../lib/vin/bmw-type-key';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { VIN_LOOKUP_MODULE } from '../../../../modules/vin-lookup';
import type VinLookupModuleService from '../../../../modules/vin-lookup/service';
import type { AdminListUnresolvedVinCodesType } from '../../validators';

type UnresolvedCode = {
  make: string;
  code: string;
  count: number;
  last_seen: Date;
  reference: TypeKey | null;
};

const referenceOf = (make: string, code: string): TypeKey | null =>
  (make === 'bmw' && typeKey(code)) || null;

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListUnresolvedVinCodesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } =
    req.validatedQuery as AdminListUnresolvedVinCodesType;
  const vinLookups: VinLookupModuleService =
    req.scope.resolve(VIN_LOOKUP_MODULE);

  // TODO: groups in memory; move to a GROUP BY query once unresolved lookups reach tens of thousands.
  const lookups = await vinLookups.listVinLookups(
    { vehicle_id: null, code: { $ne: null } },
    { select: ['make', 'code', 'updated_at'], take: null },
  );

  const catalog: CatalogModuleService = req.scope.resolve(CATALOG_MODULE);
  const known = new Set(
    (
      await catalog.listVehicleIdentifiers(
        { value: [...new Set(lookups.map(({ code }) => String(code)))] },
        { select: ['value'], take: null },
      )
    ).map(({ value }) => value),
  );

  const codes = new Map<string, UnresolvedCode>();
  for (const { make, code, updated_at } of lookups.filter(
    ({ code }) => !known.has(String(code)),
  )) {
    const key = `${make}|${code}`;
    const entry = codes.get(key) ?? {
      make: String(make),
      code: String(code),
      count: 0,
      last_seen: updated_at,
      reference: referenceOf(String(make), String(code)),
    };
    entry.count += 1;
    if (updated_at > entry.last_seen) entry.last_seen = updated_at;
    codes.set(key, entry);
  }

  const sorted = [...codes.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.make.localeCompare(b.make) ||
      a.code.localeCompare(b.code),
  );
  res.json({
    codes: sorted.slice(offset, offset + limit),
    count: sorted.length,
    offset,
    limit,
  });
}
