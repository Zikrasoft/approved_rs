import { isDeepStrictEqual } from 'node:util';

import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';
import {
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';
import type { STAGED_DATA_KINDS } from '@podbor/catalog-contract';

import { runBoundSql } from '../../lib/bound-sql';
import { spellingKey } from '../../lib/suppliers/spelling';

import StagedRecord from './models/staged-record';
import Supplier from './models/supplier';
import SupplierCategory from './models/supplier-category';
import SupplierOffer from './models/supplier-offer';

const SupplierModuleBase = MedusaService({
  Supplier,
  SupplierOffer,
  SupplierCategory,
  StagedRecord,
});

type SupplierModuleBase = InstanceType<typeof SupplierModuleBase>;

type CodeInput = { code: string } & Record<string, unknown>;

const withCodeKey = (row: CodeInput) => ({
  ...row,
  code_key: spellingKey(row.code),
});

export type SupplierOfferInput = {
  supplier_id: string;
  supplier_article_id: string;
  part_identifier_id: string;
  cost_price: number;
  currency?: string;
  stock_quantity: number;
  stock_by_location?: Record<string, number>;
  lead_time_days: number;
  created_by?: string | null;
  updated_by?: string | null;
};

export type StagedRecordInput = {
  supplier_id: string;
  part_identifier_id: string;
  kind: (typeof STAGED_DATA_KINDS)[number];
  payload: Record<string, unknown>;
};

class SupplierModuleService extends SupplierModuleBase {
  override createSupplierCategories = ((
    data: CodeInput | CodeInput[],
    sharedContext?: Context,
  ) =>
    SupplierModuleBase.prototype.createSupplierCategories.call(
      this,
      Array.isArray(data) ? data.map(withCodeKey) : withCodeKey(data),
      sharedContext,
    )) as SupplierModuleBase['createSupplierCategories'];

  @InjectTransactionManager()
  async upsertSupplierOffer(
    { created_by, ...offer }: SupplierOfferInput,
    @MedusaContext() sharedContext: Context = {},
  ) {
    const key = {
      supplier_id: offer.supplier_id,
      supplier_article_id: offer.supplier_article_id,
    };
    await this.lockKey(['supplier_offer', key], sharedContext);
    const [existing] = await this.listSupplierOffers(
      key,
      { take: 1 },
      sharedContext,
    );
    if (!existing) {
      return this.createSupplierOffers({ ...offer, created_by }, sharedContext);
    }
    const unchanged = Object.entries(offer).every(([field, value]) =>
      isDeepStrictEqual(existing[field as keyof typeof existing], value),
    );
    return unchanged
      ? existing
      : this.updateSupplierOffers({ id: existing.id, ...offer }, sharedContext);
  }

  @InjectTransactionManager()
  async dropUnlistedOffers(
    supplierId: string,
    listedArticleIds: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    await runBoundSql(
      sharedContext,
      'delete from supplier_offer where supplier_id = ? and not (supplier_article_id = any(?::text[]))',
      [supplierId, listedArticleIds],
    );
  }

  @InjectTransactionManager()
  async upsertStagedRecord(
    { payload, ...key }: StagedRecordInput,
    @MedusaContext() sharedContext: Context = {},
  ) {
    await this.lockKey(['staged_record', key], sharedContext);
    const [existing] = await this.listStagedRecords(
      key,
      { select: ['id'], take: 1 },
      sharedContext,
    );
    if (!existing) {
      return this.createStagedRecords({ ...key, payload }, sharedContext);
    }
    const json = JSON.stringify(payload);
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      'update staged_record set payload = ?, updated_at = now() where id = ? and payload is distinct from ?::jsonb',
      [json, existing.id, json],
    );
    return this.retrieveStagedRecord(existing.id, {}, sharedContext);
  }

  private async lockKey(key: unknown, sharedContext: Context): Promise<void> {
    await (sharedContext.transactionManager as SqlEntityManager).execute(
      'select pg_advisory_xact_lock(hashtextextended(?, 0))',
      [JSON.stringify(key)],
    );
  }
}

export default SupplierModuleService;
