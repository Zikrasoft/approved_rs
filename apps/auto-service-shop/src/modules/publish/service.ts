import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

import {
  attributeValuesSchema,
  MIN_REQUIREMENT_MATCHES_FOR_PAGE,
  type AttributeValues,
} from '@podbor/catalog-contract';

import CatalogueRun from './models/catalogue-run';
import PublishedNumber from './models/published-number';
import { runBoundSql } from '../_shared/bound-sql';
import {
  LISTED_CATEGORY_PARTS,
  LISTED_NUMBERS,
  LISTED_MAKE_PART_COUNTS,
  LISTED_PARTS_IN_CATEGORY,
  LISTED_SERIES_CATEGORY_COUNTS,
  LISTED_VEHICLE_PARTS,
  PART_PAGE_COUNTS,
  PART_REQUIREMENT_FITS,
  PUBLISH_ALL,
  PUBLISHED_NUMBER_BY_SLUG,
  PUBLISHED_NUMBERS,
  PUBLISHED_PAGE,
  PUBLISHED_PART_SLUGS,
  REFRESH_LISTED,
} from '../catalog/cross-module-sql';
import { INTERRUPTED_BY_RESTART } from '../_shared/run-errors';

export type MakePartCount = { make_slug: string; parts: number };

export type SeriesCategoryCount = {
  series_id: string;
  category_id: string | null;
  parts: number;
  fitted: number;
  required: number;
};

export type CategoryPart = {
  category_id: string;
  part_id: string;
  first_fitment_id: string | null;
};

export type VehiclePart = {
  vehicle_id: string;
  part_id: string;
  category_id: string | null;
  fitted: boolean;
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
  attributes: AttributeValues;
};

export type ListedNumber = {
  id: string;
  brand_slug: string;
  brand_name: string;
  normalized_value: string;
  part_id: string;
  category_id: string;
  attributes: Record<string, unknown>;
};

const placeBindings = ({ series = null }: { series?: string[] | null }) => ({
  series,
  min_matches: MIN_REQUIREMENT_MATCHES_FOR_PAGE,
});

const PRUNE_RUNS_BEFORE = `
  delete from catalogue_run r
  where r.status <> 'running' and r.created_at < ?
    and exists (
      select 1 from catalogue_run newer
      where newer.kind = r.kind
        and newer.supplier_id is not distinct from r.supplier_id
        and newer.created_at > r.created_at
    )`;

const idsOf = (rows: { id: string }[]) => rows.map(({ id }) => id);

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
  ): Promise<{ fresh: string[]; listedFlipped: string[] }> {
    const fresh = await runBoundSql(sharedContext, PUBLISH_ALL);
    const flipped = await runBoundSql(sharedContext, REFRESH_LISTED);
    return { fresh: idsOf(fresh.rows), listedFlipped: idsOf(flipped.rows) };
  }

  @InjectManager()
  async countPublished(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    const { rows } = await runBoundSql(
      sharedContext,
      'select count(*)::int as count from published_number where deleted_at is null',
    );
    return rows[0].count;
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
  async partPageCounts(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<{ published: number; projected: number }> {
    const { rows } = await runBoundSql(sharedContext, PART_PAGE_COUNTS);
    return rows[0];
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
  ): Promise<(PublishedNumber & { indexable: boolean }) | null> {
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
    return rows.map((row: ListedPart) => ({
      ...row,
      attributes: attributeValuesSchema.parse(row.attributes),
    }));
  }

  @InjectManager()
  async listedNumbers(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<ListedNumber[]> {
    const { rows } = await runBoundSql(sharedContext, LISTED_NUMBERS);
    return rows;
  }

  @InjectManager()
  async listedMakePartCounts(
    seriesIds: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<MakePartCount[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_MAKE_PART_COUNTS,
      placeBindings({ series: seriesIds }),
    );
    return rows;
  }

  @InjectManager()
  async listedSeriesCategoryCounts(
    @MedusaContext() sharedContext: Context = {},
  ): Promise<SeriesCategoryCount[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_SERIES_CATEGORY_COUNTS,
      placeBindings({}),
    );
    return rows;
  }

  @InjectManager()
  async listedCategoryParts(
    seriesIds: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<CategoryPart[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_CATEGORY_PARTS,
      placeBindings({ series: seriesIds }),
    );
    return rows;
  }

  @InjectManager()
  async listedVehicleParts(
    seriesId: string,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<VehiclePart[]> {
    const { rows } = await runBoundSql(
      sharedContext,
      LISTED_VEHICLE_PARTS,
      placeBindings({ series: [seriesId] }),
    );
    return rows;
  }

  @InjectManager()
  async partRequirementFits(
    partIds: string[],
    @MedusaContext() sharedContext: Context = {},
  ): Promise<Omit<VehiclePart, 'fitted'>[]> {
    if (!partIds.length) return [];
    const { rows } = await runBoundSql(sharedContext, PART_REQUIREMENT_FITS, [
      partIds,
    ]);
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
