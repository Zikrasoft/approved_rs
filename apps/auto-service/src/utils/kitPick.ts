import type { PartOffer } from '@podbor/catalog-contract';
import { bestOffer, isBuyable } from '@podbor/catalog-contract/availability';

type KitPage = { superseded: boolean; offers: PartOffer[] };

export function kitPick<Page extends KitPage>(
  pages: Page[],
): { page: Page; offer: PartOffer | null } {
  const offer = bestOffer(pages.flatMap(({ offers }) => offers));
  const page = offer && pages.find(({ offers }) => offers.includes(offer));
  return offer && page && isBuyable(offer)
    ? { page, offer }
    : {
        page: pages.find(({ superseded }) => !superseded) ?? pages[0],
        offer: null,
      };
}

export const kitTotal = (lines: { price: number; quantity: number }[]) =>
  lines.reduce((sum, { price, quantity }) => sum + price * quantity, 0);
