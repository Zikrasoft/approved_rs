import type { PartOffer } from '@podbor/catalog-contract';

type KitPage = { superseded: boolean; offers: PartOffer[] };

export function kitPick<Page extends KitPage>(
  pages: Page[],
): { page: Page; offer: PartOffer | null } {
  const inStock = pages
    .flatMap((page) =>
      page.offers
        .filter(({ stock_quantity }) => stock_quantity > 0)
        .map((offer) => ({ page, offer })),
    )
    .sort((a, b) => a.offer.price - b.offer.price);
  return (
    inStock[0] ?? {
      page: pages.find(({ superseded }) => !superseded) ?? pages[0],
      offer: null,
    }
  );
}
