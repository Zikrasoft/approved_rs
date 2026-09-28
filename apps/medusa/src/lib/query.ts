import type { RemoteQueryFunction } from '@medusajs/framework/types';

export type Query = Omit<RemoteQueryFunction, symbol>;

export async function queryOne<T>(
  query: Query,
  entity: string,
  fields: readonly string[],
  filters: Record<string, unknown>,
): Promise<T | undefined> {
  const { data } = await query.graph({ entity, fields: [...fields], filters });
  return data[0];
}
