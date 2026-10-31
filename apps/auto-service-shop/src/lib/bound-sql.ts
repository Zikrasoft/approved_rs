import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import type { SqlEntityManager } from '@medusajs/framework/mikro-orm/postgresql';
import type { Context } from '@medusajs/framework/types';

export const runBoundSql = (
  context: Context,
  sql: string,
  bindings: Knex.RawBinding[],
) => {
  const manager = context.transactionManager as SqlEntityManager;
  const query = manager.getKnex().raw(sql, bindings);
  const transaction = manager.getTransactionContext<Knex.Transaction>();
  return transaction ? query.transacting(transaction) : query;
};
