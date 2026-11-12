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
  make: string | null;
  code: string | null;
  code_type: VehicleIdentifierType | null;
  vehicle_id: string | null;
};

export type UnresolvedCode = {
  make: string;
  code: string;
  count: number;
  customers: number;
  visitors: string[];
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

export type VisitorLookup = {
  vin: string | null;
  make: string | null;
  code: string | null;
  vehicle_id: string | null;
  at: Date;
};

// TODO: vin_lookup_hit has no index on visitor_id, so this scans every hit; add one when the table grows past a quick scan
const VISITOR_LOOKUPS = `
  select vin, make, code, vehicle_id, at from (
    select distinct on (l.id) l.vin, l.make, l.code, l.vehicle_id, h.created_at as at
    from vin_lookup_hit h
    join vin_lookup l on l.id = h.vin_lookup_id and l.deleted_at is null
    where h.visitor_id = ? and h.deleted_at is null
    order by l.id, h.created_at desc
  ) latest
  order by at desc
  limit ?`;

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
  async visitorLookups(
    visitorId: string,
    limit: number,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<VisitorLookup[]> {
    const { rows }: { rows: VisitorLookup[] } = await runBoundSql(
      sharedContext,
      VISITOR_LOOKUPS,
      [visitorId, limit],
    );
    return rows;
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
          make,
          code,
          count,
          customers,
          visitors,
          storefront,
          workshop_quote,
          admin,
          last_seen,
        }) => ({
          make,
          code,
          count,
          customers,
          visitors,
          sources: { storefront, 'workshop-quote': workshop_quote, admin },
          last_seen,
        }),
      ),
      count: rows[0]?.total ?? 0,
    };
  }
}

export default VinLookupModuleService;
