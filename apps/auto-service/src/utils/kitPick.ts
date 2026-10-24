import type { PartOffer } from '@podbor/catalog-contract';
import { isBuyable } from '@podbor/catalog-contract/availability';

type KitPage = { superseded: boolean; offers: PartOffer[] };

const inStockFirst = (offer: PartOffer) => Number(offer.stock_quantity > 0);

export function kitPick<Page extends KitPage>(
  pages: Page[],
): { page: Page; offer: PartOffer | null } {
  const buyable = pages
    .flatMap((page) =>
      page.offers.filter(isBuyable).map((offer) => ({ page, offer })),
    )
    .sort(
      (a, b) =>
        inStockFirst(b.offer) - inStockFirst(a.offer) ||
        a.offer.price - b.offer.price,
    );
  return (
    buyable[0] ?? {
      page: pages.find(({ superseded }) => !superseded) ?? pages[0],
      offer: null,
    }
  );
}
