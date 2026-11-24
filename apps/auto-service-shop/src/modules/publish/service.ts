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
  LISTED_NUMBERS_IN_CATEGORY,
  LISTED_PART_COUNTS,
  LISTED_PARTS_IN_CATEGORY,
  LISTED_PER_CATEGORY,
  LISTED_SERIES_CATEGORY_COUNTS,
  PUBLISH_ALL,
  PUBLISHED_NUMBER_BY_SLUG,
  PUBLISHED_NUMBERS,
  PUBLISHED_PAGE,
  PUBLISHED_PART_SLUGS,
  REFRESH_LISTED,
} from '../catalog/cross-module-sql';
import { INTERRUPTED_BY_RESTART } from '../_shared/run-errors';

export type ListedPartCount = {
  series_id: string;
  parts: number;
  required: number;
};

export type SeriesCategoryCount = {
  series_id: string;
  category_id: string;
  parts: number;
};

export type PublishedPartSlug = {
  brand_slug: string;
  normalized_value: string;
  indexable: boolean;
};

export type PublishedNumber = { id: string; listed: boolean | null };

export type ListedPart = {
  id: string;
  category_id: string;
  attributes: Record<string, unknown>;
};

export type ListedNumber = {
  id: string;
  brand_slug: string;
  brand_name: string;
  normalized_value: string;
  part_id: string;
  attributes: Record<string, unknown>;
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
  async publishedBySlug(
    brandSlug: string,
    normalizedValue: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<PublishedNumber | null> {
    const { rows } = await runBoundSql(
      sharedContext,
      PUBLISHED_NUMBER_BY_SLUG,
      [brandSlug, normalizedValue],
    );
    return rows[0] ?? null;
  }

  @InjectManager()
  async publishedNumbers(
    ids: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<PublishedNumber[]> {
    if (!ids.length) return [];
    const { rows } = await runBoundSql(sharedContext, PUBLISHED_NUMBERS, [ids]);
    return rows;
  }

  @InjectManager()
  async listedPartsIn(
    categoryId: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedPart[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_PARTS_IN_CATEGORY,
      [categoryId],
    );
    return rows;
  }

  @InjectManager()
  async listedNumbersIn(
    categoryId: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedNumber[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_NUMBERS_IN_CATEGORY,
      [categoryId],
    );
    return rows;
  }

  @InjectManager()
  async listedPartCounts(
    requirementFits: PartFit[],
    seriesIds: string[] | null = null,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedPartCount[]> {
    const { rows } = await runBoundSql(sharedContext, LISTED_PART_COUNTS, [
      requirementFits.map(({ vehicle_id }) => vehicle_id),
      requirementFits.map(({ part_id }) => part_id),
      requirementFits.map(({ category_id }) => category_id),
      MIN_REQUIREMENT_MATCHES_FOR_PAGE,
      seriesIds,
      seriesIds,
    ]);
    return rows;
  }

  @InjectManager()
  async listedSeriesCategoryCounts(
    requirementFits: PartFit[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<SeriesCategoryCount[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_SERIES_CATEGORY_COUNTS,
      [
        requirementFits.map(({ vehicle_id }) => vehicle_id),
        requirementFits.map(({ part_id }) => part_id),
        requirementFits.map(({ category_id }) => category_id),
      ],
    );
    return rows;
  }

  @InjectManager()
  async publishedPartSlugs(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<PublishedPartSlug[]> {
    const { rows } = await runBoundSql(sharedContext, PUBLISHED_PART_SLUGS);
    return rows;
  }

  @InjectManager()
  async listedPerCategory(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ category_id: string; listed: number }[]> {
    const { rows } = await runBoundSql(sharedContext, LISTED_PER_CATEGORY);
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
