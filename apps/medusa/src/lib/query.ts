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

export const QUERY_PAGE = 200;

export async function queryAll<T>(
  query: Query,
  entity: string,
  fields: readonly string[],
): Promise<T[]> {
  const found: T[] = [];
  let page: unknown[];
  do {
    ({ data: page } = await query.graph({
      entity,
      fields: [...fields],
      pagination: { take: QUERY_PAGE, skip: found.length },
    }));
    found.push(...(page as T[]));
  } while (page.length === QUERY_PAGE);
  return found;
}
