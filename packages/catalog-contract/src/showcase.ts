import { bestOffer, type RankableOffer } from './availability.ts';

export const MAKE_TOP_CATEGORIES = 6;
export const MAKE_SHOWCASE = 6;

export type Showcased = {
  offers: (RankableOffer & { id: string; stock_quantity: number })[];
  images: unknown[];
  supplier_data: { images: unknown[] };
  category: { image: unknown } | null;
};

const bestOfPages = (pages: Showcased[]) =>
  bestOffer(pages.flatMap(({ offers }) => offers));

export const offerRank = (offers: Showcased['offers']): number => {
  const best = bestOffer(offers);
  return best ? (best.stock_quantity > 0 ? 0 : 1) : 2;
};

export const bestPage = <Page extends Showcased>(
  pages: Page[],
): Page | undefined => {
  const best = bestOfPages(pages);
  return pages.find(({ offers }) => offers.some(({ id }) => id === best?.id));
};

export const pictureRank = (page: Showcased): number => {
  if (page.images.length + page.supplier_data.images.length > 0) return 0;
  return page.category?.image ? 1 : 2;
};

export const showcaseOf = <Page extends Showcased>(
  queues: Page[][][],
): Page[] => {
  const picks = queues
    .flatMap((queue, column) =>
      queue
        .map((pages) => ({
          pages,
          rank: offerRank(pages.flatMap(({ offers }) => offers)),
        }))
        .sort((a, b) => a.rank - b.rank)
        .map((pick, round) => ({ ...pick, round, column })),
    )
    .sort((a, b) => a.rank - b.rank || a.round - b.round || a.column - b.column)
    .slice(0, MAKE_SHOWCASE)
    .map(({ pages, column }) => {
      const page = bestPage(pages) ?? pages[0];
      return { page, column, picture: pictureRank(page) };
    });
  const lead = (column: number) =>
    Math.min(
      ...picks.filter((pick) => pick.column === column).map((p) => p.picture),
    );
  return [...picks]
    .sort(
      (a, b) =>
        lead(a.column) - lead(b.column) ||
        a.column - b.column ||
        a.picture - b.picture,
    )
    .map(({ page }) => page);
};
