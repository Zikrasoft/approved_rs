import type { Context } from '@medusajs/framework/types';
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from '@medusajs/framework/utils';

import { runBoundSql } from '../_shared/bound-sql';
import DemandReceipt from './models/demand-receipt';
import MissedQuery from './models/missed-query';
import PartDemandDay from './models/part-demand-day';
import type { DemandCounts } from './ranking';

const SIGNAL_COLUMNS = {
  inquiry: 'inquiries',
  order: 'orders',
  pick: 'picks',
} as const;

export type DemandSignal = keyof typeof SIGNAL_COLUMNS;

export type IdentifierDemand = DemandCounts & { id: string };

export type MissedQueryCount = { query: string; count: number };

const dayOf = (at: Date) => at.toISOString().slice(0, 10);

const RECEIVE = `
  insert into demand_receipt (id, day) values (?, ?)
  on conflict (id) do nothing returning id`;

const countSignal = (column: string) => `
  insert into part_demand_day (id, part_identifier_id, day, ${column})
  select identifier || '|' || ?, identifier, ?, 1
  from unnest(?::text[]) as identifier
  on conflict (id) do update
  set ${column} = part_demand_day.${column} + 1, updated_at = now()`;

const COUNT_MISSED_QUERY = `
  insert into missed_query (id, query, day, count) values (? || '|' || ?, ?, ?, 1)
  on conflict (id) do update
  set count = missed_query.count + 1, updated_at = now()`;

const COUNTS_SINCE = `
  select part_identifier_id as id, sum(inquiries)::int as inquiries,
    sum(orders)::int as orders, sum(picks)::int as picks
  from part_demand_day where day >= ?
  group by part_identifier_id`;

const MISSED_QUERIES_SINCE = `
  select query, sum(count)::int as count from missed_query
  where day >= ? group by query
  order by count desc, query limit ?`;

const PRUNED_TABLES = ['part_demand_day', 'demand_receipt', 'missed_query'];

class DemandModuleService extends MedusaService({
  PartDemandDay,
  DemandReceipt,
  MissedQuery,
}) {
  @InjectTransactionManager()
  async record(
    {
      signal,
      identifierIds,
      key = null,
      at = new Date(),
    }: {
      signal: DemandSignal;
      identifierIds: string[];
      key?: string | null;
      at?: Date;
    },
    @MedusaContext() sharedContext: Context = {},
  ): Promise<boolean> {
    const ids = [...new Set(identifierIds)];
    if (!ids.length) return false;
    const day = dayOf(at);
    if (key) {
      const { rows } = await runBoundSql(sharedContext, RECEIVE, [key, day]);
      if (!rows.length) return false;
    }
    await runBoundSql(sharedContext, countSignal(SIGNAL_COLUMNS[signal]), [
      day,
      day,
      ids,
    ]);
    return true;
  }

  @InjectManager()
  async recordMissedQuery(
    query: string,
    at: Date = new Date(),
    @MedusaContext() sharedContext: Context = {},
  ): Promise<void> {
    const day = dayOf(at);
    await runBoundSql(sharedContext, COUNT_MISSED_QUERY, [
      day,
      query,
      query,
      day,
    ]);
  }

  @InjectManager()
  async countsSince(
    since: Date,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<IdentifierDemand[]> {
    const { rows } = await runBoundSql(sharedContext, COUNTS_SINCE, [
      dayOf(since),
    ]);
    return rows;
  }

  @InjectManager()
  async missedQueriesSince(
    since: Date,
    limit: number,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<MissedQueryCount[]> {
    const { rows } = await runBoundSql(sharedContext, MISSED_QUERIES_SINCE, [
      dayOf(since),
      limit,
    ]);
    return rows;
  }

  @InjectTransactionManager()
  async pruneBefore(
    cutoff: Date,
    @MedusaContext() sharedContext: Context = {},
  ): Promise<number> {
    let pruned = 0;
    for (const table of PRUNED_TABLES) {
      const { rowCount } = await runBoundSql(
        sharedContext,
        `delete from ${table} where day < ?`,
        [dayOf(cutoff)],
      );
      pruned += rowCount ?? 0;
    }
    return pruned;
  }
}

export default DemandModuleService;
