import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { type TypeKey, typeKey } from '../../../../lib/vin/bmw-type-key';
import type { AdminListUnresolvedVinCodesType } from '../../validators';

type CodeRow = {
  make: string;
  code: string;
  count: number;
  last_seen: Date;
  total: number;
};

const referenceOf = (make: string, code: string): TypeKey | null =>
  (make === 'bmw' && typeKey(code)) || null;

const UNRESOLVED_CODES = `
  select make, code, count(*)::int as count, max(updated_at) as last_seen,
    (count(*) over ())::int as total
  from vin_lookup l
  where vehicle_id is null and make is not null and code is not null
    and deleted_at is null
    and not exists (
      select 1 from vehicle_identifier vi
      where vi.value = l.code and vi.supplier_id is null and vi.deleted_at is null
    )
  group by make, code
  order by count desc, make, code
  offset ? limit ?`;

export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminListUnresolvedVinCodesType>,
  res: MedusaResponse,
): Promise<void> {
  const { offset, limit } =
    req.validatedQuery as AdminListUnresolvedVinCodesType;
  const { rows } = await req.scope
    .resolve(ContainerRegistrationKeys.PG_CONNECTION)
    .raw<{ rows: CodeRow[] }>(UNRESOLVED_CODES, [offset, limit]);
  res.json({
    codes: rows.map(({ make, code, count, last_seen }) => ({
      make,
      code,
      count,
      last_seen,
      reference: referenceOf(make, code),
    })),
    count: rows[0]?.total ?? 0,
    offset,
    limit,
  });
}
