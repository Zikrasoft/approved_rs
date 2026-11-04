import type { PartDemand } from '@podbor/catalog-contract';

export const DEMAND_PARTS_FIELD = 'demand_parts';
export const POPULAR_BLOCK_MIN = 2;
export const POPULAR_BLOCK_SIZE = 6;

type Demanded = { demand: PartDemand | null };

const scoreOf = ({ demand }: Demanded) => demand?.score ?? 0;

export const demandOf = (pages: Demanded[]): number =>
  pages.reduce((sum, page) => sum + scoreOf(page), 0);

export const isTopDemand = (pages: Demanded[]): boolean =>
  pages.some(({ demand }) => demand?.top);

export const byDemand = <T>(items: T[], score: (item: T) => number): T[] =>
  [...items].sort((a, b) => score(b) - score(a));

export function popularPicks<T extends Demanded & { part?: { id: string } }>(
  pages: T[],
): T[] {
  const seen = new Set<string>();
  const picks = byDemand(
    pages.filter(({ demand }) => demand?.popular),
    scoreOf,
  ).filter(({ part }) => !part || (!seen.has(part.id) && seen.add(part.id)));
  return picks.length >= POPULAR_BLOCK_MIN
    ? picks.slice(0, POPULAR_BLOCK_SIZE)
    : [];
}
