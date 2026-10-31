import { CART_NOTICE_PARAM } from '@/utils/cartNotice';
import { kitTotal } from '@/utils/kitPick';
import { formatMoney } from '@/utils/money';
import { vinFrom } from '@/utils/carFacts';
import { readCart, rememberCart } from './cartStore';
import { busy, isBusy, sendJson } from './cartUi';
import { PRICES_FILLED_EVENT } from './shopPreview';
import { addToPartsList, listedPartFromDataset } from './partsList';

export function defineKitCart(tagName = 'kit-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const button = this.querySelector('button');
        button?.addEventListener('click', () => {
          if (isBusy(button)) return;
          busy(button, true);
          void this.addKit();
        });
        document.addEventListener(PRICES_FILLED_EVENT, () => this.priced());
      }

      priced(): void {
        const kit = this.closest<HTMLElement>('parts-list-add-all');
        const items = [
          ...(kit?.querySelectorAll<HTMLElement>('[data-kit-part]') ?? []),
        ];
        for (const item of items) {
          const offer =
            item.querySelector<HTMLElement>('[data-kit-offer]')?.dataset
              .kitOffer;
          if (offer) item.dataset.offerId = offer;
          else delete item.dataset.offerId;
        }
        const buyable = items.every((item) => item.dataset.offerId);
        this.hidden = !buyable;
        const tags = items.map(
          (item) =>
            item.querySelector<HTMLElement>('[data-kit-offer]')?.dataset ?? {},
        );
        const total = this.querySelector('[data-kit-total]');
        if (total && buyable) {
          total.textContent = ` · ${formatMoney(
            kitTotal(
              items.map((item, index) => ({
                price: Number(tags[index].kitPrice),
                quantity: Number(item.dataset.quantity) || 1,
              })),
            ),
            tags[0]?.kitCurrency ?? 'RSD',
            this.dataset.localeTag ?? 'sr',
          )}`;
        }
        const ask = kit?.querySelector('[data-add-all]');
        ask?.classList.toggle('btn-secondary', buyable);
        ask?.classList.toggle('btn-primary', !buyable);
      }

      async addKit(): Promise<void> {
        const kit = this.closest<HTMLElement>('parts-list-add-all');
        const vin = vinFrom(location.search);
        let cartId = readCart()?.id ?? null;
        let moved = false;
        for (const item of kit?.querySelectorAll<HTMLElement>(
          '[data-offer-id]:not([hidden])',
        ) ?? []) {
          const outcome = await sendJson('POST', {
            cart_id: cartId,
            offer_id: item.dataset.offerId,
            quantity: Number(item.dataset.quantity) || 1,
          });
          if (outcome?.kind === 'cart') {
            rememberCart(outcome.cart);
            cartId = outcome.cart.id;
            continue;
          }
          const part = listedPartFromDataset(item.dataset, {
            car: kit?.dataset.car,
            ...(vin && { vin }),
          });
          if (part) addToPartsList(part);
          moved = true;
        }
        const href = this.dataset.cartHref ?? '';
        if (moved) {
          location.assign(
            `${href}?${new URLSearchParams({ [CART_NOTICE_PARAM]: 'moved' })}`,
          );
          return;
        }
        const added = kit?.querySelector<HTMLElement>('[data-kit-added]');
        if (!added) {
          location.assign(href);
          return;
        }
        this.hidden = true;
        added.hidden = false;
      }
    },
  );
}
