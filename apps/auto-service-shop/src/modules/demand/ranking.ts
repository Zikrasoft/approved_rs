import type { PartDemand } from '@podbor/catalog-contract';

export const DEMAND_WEIGHTS = { orders: 5, inquiries: 3, picks: 1 } as const;
export const DEMAND_WINDOW_DAYS = 30;
export const POPULAR_MIN_SIGNALS = 2;
export const TOP_IN_CATEGORY = 3;

export type DemandCounts = { inquiries: number; orders: number; picks: number };

export type CategorisedDemand = DemandCounts & {
  id: string;
  category_id: string | null;
};

export const demandScore = ({ inquiries, orders, picks }: DemandCounts) =>
  orders * DEMAND_WEIGHTS.orders +
  inquiries * DEMAND_WEIGHTS.inquiries +
  picks * DEMAND_WEIGHTS.picks;

const isPopular = ({ inquiries, orders }: DemandCounts) =>
  inquiries + orders >= POPULAR_MIN_SIGNALS;

export function rankDemand(rows: CategorisedDemand[]): Map<string, PartDemand> {
  const scored = rows
    .map((row) => ({ row, score: demandScore(row), popular: isPopular(row) }))
    .sort((a, b) => b.score - a.score || a.row.id.localeCompare(b.row.id));
  const placed = new Map<string, number>();
  return new Map(
    scored.map(({ row, score, popular }) => {
      const category = row.category_id;
      const rank = popular && category ? (placed.get(category) ?? 0) : null;
      if (rank !== null && category) placed.set(category, rank + 1);
      return [
        row.id,
        { score, popular, top: rank !== null && rank < TOP_IN_CATEGORY },
      ];
    }),
  );
}
