import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';
import type { VehicleIdentifierType } from '@podbor/catalog-contract';

import type { LookupOrigin, SourceCounts } from '../../lib/vin/sources';
import { runBoundSql } from '../_shared/bound-sql';
import { UNRESOLVED_VIN_CODES } from '../catalog/cross-module-sql';
import VinLookup from './models/vin-lookup';
import VinLookupHit from './models/vin-lookup-hit';

type LookupRecord = {
  vin: string;
  decoder: string | null;
  decoder_version: number | null;
  raw: Record<string, unknown> | null;
  facts: Record<string, unknown>;
  make_key: string | null;
  code: string | null;
  code_type: VehicleIdentifierType | null;
  vehicle_id: string | null;
};

export type UnresolvedCode = {
  make_key: string;
  code: string;
  count: number;
  customers: number;
  sources: SourceCounts;
  last_seen: Date;
};

type UnresolvedCodeRow = Omit<UnresolvedCode, 'sources'> & {
  storefront: number;
  workshop_quote: number;
  admin: number;
  total: number;
};

const SCRUB_BEFORE = `
  update vin_lookup
  set wmi = coalesce(wmi, left(vin, 3)), vin = null, raw = null, facts = '{}'::jsonb
  where vin is not null and updated_at < ?`;

const FORGET_VISITORS_BEFORE = `
  update vin_lookup_hit set visitor_id = null
  where visitor_id is not null and created_at < ?`;

class VinLookupModuleService extends MedusaService({
  VinLookup,
  VinLookupHit,
}) {
  @InjectTransactionManager()
  async saveLookup(
    record: LookupRecord,
    origin: LookupOrigin,
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
    const row = { ...record, wmi: record.vin.slice(0, 3) };
    const { id } = await (existing
      ? this.updateVinLookups({ id: existing.id, ...row }, sharedContext)
      : this.createVinLookups(row, sharedContext));
    await this.createVinLookupHits(
      { ...origin, vin_lookup_id: id },
      sharedContext,
    );
  }

  @InjectManager()
  async scrubLookupsBefore(
    cutoff: Date,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    await runBoundSql(sharedContext, FORGET_VISITORS_BEFORE, [cutoff]);
    const { rowCount } = await runBoundSql(sharedContext, SCRUB_BEFORE, [
      cutoff,
    ]);
    return rowCount ?? 0;
  }

  @InjectManager()
  async unresolvedCodes(
    {
      offset,
      limit,
      all,
      staffVisitorIds,
    }: {
      offset: number;
      limit: number;
      all: boolean;
      staffVisitorIds: string[];
    },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ codes: UnresolvedCode[]; count: number }> {
    const { rows }: { rows: UnresolvedCodeRow[] } = await runBoundSql(
      sharedContext,
      UNRESOLVED_VIN_CODES,
      [staffVisitorIds, all, offset, limit],
    );
    return {
      codes: rows.map(
        ({
          make_key,
          code,
          count,
          customers,
          storefront,
          workshop_quote,
          admin,
          last_seen,
        }) => ({
          make_key,
          code,
          count,
          customers,
          sources: { storefront, 'workshop-quote': workshop_quote, admin },
          last_seen,
        }),
      ),
      count: rows[0]?.total ?? 0,
    };
  }
}

export default VinLookupModuleService;
