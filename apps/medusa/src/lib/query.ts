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
      pagination: {
        take: QUERY_PAGE,
        skip: found.length,
        order: { id: 'ASC' },
      },
    }));
    found.push(...(page as T[]));
  } while (page.length === QUERY_PAGE);
  return found;
}

// TODO: a raw BigNumber ({ value, precision }) is refused rather than read. Queried
// amounts are plain numbers in Medusa 2.19; if one ever arrives raw, every order
// hard-fails instead of one amount degrading.
export function money(value: unknown): number {
  const readable =
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '');
  const parsed = readable ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    throw new Error(`unreadable amount of type ${typeof value}`);
  }
  return parsed;
}
