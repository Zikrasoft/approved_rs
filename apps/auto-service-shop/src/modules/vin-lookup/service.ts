import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

import { runBoundSql } from '../_shared/bound-sql';
import VinLookup from './models/vin-lookup';

type LookupRecord = {
  vin: string;
  decoder: string | null;
  decoder_version: number | null;
  raw: Record<string, unknown> | null;
  facts: Record<string, unknown>;
  make: string | null;
  code: string | null;
  vehicle_id: string | null;
};

export type UnresolvedCode = {
  make: string;
  code: string;
  count: number;
  last_seen: Date;
};

type UnresolvedCodeRow = UnresolvedCode & { total: number };

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

class VinLookupModuleService extends MedusaService({
  VinLookup,
}) {
  @InjectTransactionManager()
  async saveLookup(
    record: LookupRecord,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [`vin_lookup:${record.vin}`],
    );
    const [existing] = await this.listVinLookups(
      { vin: record.vin },
      { select: ['id'] },
      sharedContext,
    );
    await (existing
      ? this.updateVinLookups({ id: existing.id, ...record }, sharedContext)
      : this.createVinLookups(record, sharedContext));
  }

  @InjectManager()
  async unresolvedCodes(
    { offset, limit }: { offset: number; limit: number },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ codes: UnresolvedCode[]; count: number }> {
    const { rows }: { rows: UnresolvedCodeRow[] } = await runBoundSql(
      sharedContext,
      UNRESOLVED_CODES,
      [offset, limit],
    );
    return {
      codes: rows.map(({ make, code, count, last_seen }) => ({
        make,
        code,
        count,
        last_seen,
      })),
      count: rows[0]?.total ?? 0,
    };
  }
}

export default VinLookupModuleService;
