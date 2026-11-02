import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

import { MIN_REQUIREMENT_MATCHES_FOR_PAGE } from '@podbor/catalog-contract';

import CatalogueRun from './models/catalogue-run';
import PublishedNumber from './models/published-number';
import { runBoundSql } from '../_shared/bound-sql';
import {
  LISTED_PART_COUNTS,
  PUBLISH_ALL,
  PUBLISHED_PAGE,
  REFRESH_LISTED,
} from '../catalog/cross-module-sql';
import { INTERRUPTED_BY_RESTART } from '../_shared/run-errors';

export type ListedPartCount = {
  model_id: string;
  vehicle_id: string | null;
  parts: number;
  required: number;
};

export type PartFit = {
  vehicle_id: string;
  part_id: string;
  category_id: string;
};

const PRUNE_RUNS_BEFORE = `
  delete from catalogue_run r
  where r.status <> 'running' and r.created_at < ?
    and exists (
      select 1 from catalogue_run newer
      where newer.kind = r.kind
        and newer.supplier_id is not distinct from r.supplier_id
        and newer.created_at > r.created_at
    )`;

const inServerWorkerMode = () => process.env.MEDUSA_WORKER_MODE === 'server';

class PublishModuleService extends MedusaService({
  CatalogueRun,
  PublishedNumber,
}) {
  __hooks = {
    onApplicationStart: async () => {
      if (!inServerWorkerMode()) await this.failRunsLeftRunning();
    },
  };

  @InjectTransactionManager()
  async publishAll(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<string[]> {
    const { rows } = await runBoundSql(sharedContext, PUBLISH_ALL);
    await runBoundSql(sharedContext, REFRESH_LISTED);
    return rows.map(({ id }: { id: string }) => id);
  }

  @InjectTransactionManager()
  async unpublish(
    ids: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    if (ids.length) {
      await runBoundSql(
        sharedContext,
        'delete from published_number where id = any(?::text[])',
        [ids],
      );
      await runBoundSql(sharedContext, REFRESH_LISTED);
    }
  }

  @InjectManager()
  async publishedPage(
    { after, limit }: { after?: string; limit: number },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ id: string; listed: boolean }[]> {
    const { rows } = await runBoundSql(sharedContext, PUBLISHED_PAGE, [
      after ?? null,
      after ?? null,
      limit,
    ]);
    return rows;
  }

  @InjectManager()
  async listedPartCounts(
    requirementFits: PartFit[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedPartCount[]> {
    const { rows } = await runBoundSql(sharedContext, LISTED_PART_COUNTS, [
      requirementFits.map(({ vehicle_id }) => vehicle_id),
      requirementFits.map(({ part_id }) => part_id),
      requirementFits.map(({ category_id }) => category_id),
      MIN_REQUIREMENT_MATCHES_FOR_PAGE,
      MIN_REQUIREMENT_MATCHES_FOR_PAGE,
    ]);
    return rows;
  }

  @InjectManager()
  async pruneRunsBefore(
    cutoff: Date,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    const { rowCount } = await runBoundSql(sharedContext, PRUNE_RUNS_BEFORE, [
      cutoff,
    ]);
    return rowCount ?? 0;
  }

  async failRunsLeftRunning(): Promise<void> {
    const running = await this.listCatalogueRuns(
      { status: 'running' },
      { select: ['id'] },
    );
    if (running.length) {
      await this.updateCatalogueRuns(
        running.map(({ id }) => ({
          id,
          status: 'failed' as const,
          error: INTERRUPTED_BY_RESTART,
          finished_at: new Date(),
        })),
      );
    }
  }
}

export default PublishModuleService;
