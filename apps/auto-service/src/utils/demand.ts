import type { PartDemand } from '@podbor/catalog-contract';

export {
  POPULAR_BLOCK_MIN,
  POPULAR_BLOCK_SIZE,
  popularPicks,
} from '@podbor/catalog-contract';

export const DEMAND_PARTS_FIELD = 'demand_parts';

type Demanded = { demand: PartDemand | null };

export const isTopDemand = (pages: Demanded[]): boolean =>
  pages.some(({ demand }) => demand?.top);

export const byDemand = <T>(items: T[], score: (item: T) => number): T[] =>
  [...items].sort((a, b) => score(b) - score(a));
