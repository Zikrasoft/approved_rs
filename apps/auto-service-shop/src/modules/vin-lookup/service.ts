import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

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
}

export default VinLookupModuleService;
