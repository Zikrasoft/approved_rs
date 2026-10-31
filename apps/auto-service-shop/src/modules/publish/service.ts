import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

import CatalogueRun from './models/catalogue-run';
import PublishedNumber from './models/published-number';
import { runBoundSql } from '../_shared/bound-sql';
import { INTERRUPTED_BY_RESTART } from '../_shared/run-errors';

export type ListedPartCount = {
  model_id: string;
  vehicle_id: string | null;
  parts: number;
};

const PUBLISH_ALL = `
  insert into published_number (id)
  select id from part_identifier where deleted_at is null
  on conflict (id) do nothing
  returning id`;

const PUBLISHED_PAGE = `
  select pn.id from published_number pn
  join part_identifier pi on pi.id = pn.id and pi.deleted_at is null
  where pn.deleted_at is null and (?::text is null or pn.id > ?)
  order by pn.id
  limit ?`;

const LISTED_PART_COUNTS = `
  with published_parts as (
    select distinct pi.part_id from part_identifier pi
    join published_number pn on pn.id = pi.id and pn.deleted_at is null
    where pi.deleted_at is null
  ), listed as (
    select p.id from part p
    join published_parts pp on pp.part_id = p.id
    where p.deleted_at is null and (
      p.replaced_by_id is null
      or not exists (
        select 1 from published_parts r where r.part_id = p.replaced_by_id
      )
    )
  )
  select v.model_id, f.vehicle_id, count(distinct f.part_id)::int as parts
  from fitment f
  join listed l on l.id = f.part_id
  join vehicle v on v.id = f.vehicle_id and v.deleted_at is null
  where f.deleted_at is null
  group by grouping sets ((v.model_id, f.vehicle_id), (v.model_id))`;

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
    }
  }

  @InjectManager()
  async publishedPage(
    { after, limit }: { after?: string; limit: number },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ id: string }[]> {
    const { rows } = await runBoundSql(sharedContext, PUBLISHED_PAGE, [
      after ?? null,
      after ?? null,
      limit,
    ]);
    return rows;
  }

  @InjectManager()
  async listedPartCounts(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedPartCount[]> {
    const { rows } = await runBoundSql(sharedContext, LISTED_PART_COUNTS);
    return rows;
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
