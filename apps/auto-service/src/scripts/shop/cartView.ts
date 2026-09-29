import { formatPrice } from '@podbor/shop-catalog/browser';
import type { Locale } from '@/i18n/config';
import {
  currentCart,
  loadCart,
  onCart,
  refreshCart,
  removeFromCart,
  setQuantity,
} from './cart';
import { isOutOfStock, type Cart, type CartLine } from './cartApi';

const MAX_QUANTITY = 99;

export function defineCartView(tagName = 'cart-view'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const list = this.querySelector<HTMLElement>('[data-lines]');
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-line]',
        );
        if (!list || !template) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const part = (name: string) =>
          this.querySelector<HTMLElement>(`[data-${name}]`);
        const empty = part('empty');
        const summary = part('summary');
        const total = part('total');
        const checkout = part('checkout');
        const placedPanel = part('placed');
        const failure = part('cart-error');
        const bcp47 = this.dataset.bcp47 ?? 'sr-Latn-RS';
        const services = JSON.parse(this.dataset.services ?? '{}') as Record<
          string,
          string
        >;
        const errors = JSON.parse(this.dataset.errors ?? '{}') as Record<
          string,
          string
        >;
        let placed = false;

        const complain = (error: unknown) => {
          if (placed || !failure) return;
          failure.textContent = isOutOfStock(error)
            ? (errors.stock ?? '')
            : (errors.generic ?? '');
          failure.hidden = false;
          refreshCart().catch((reason: unknown) =>
            console.warn('[cart] not refreshed', reason),
          );
        };

        const line = (entry: CartLine) => {
          const item = template.content.firstElementChild!.cloneNode(
            true,
          ) as HTMLElement;
          item.querySelector('[data-line-title]')!.textContent =
            (entry.product_handle && services[entry.product_handle]) ||
            entry.product_title ||
            '';
          item.querySelector('[data-line-price]')!.textContent =
            `${entry.quantity} × ${formatPrice(entry.unit_price, bcp47)}`;
          const quantity = item.querySelector<HTMLInputElement>(
            '[data-line-quantity]',
          )!;
          quantity.value = String(entry.quantity);
          quantity.max = String(MAX_QUANTITY);
          quantity.addEventListener('change', () => {
            failure?.setAttribute('hidden', '');
            const wanted = Math.min(
              Math.max(Math.trunc(Number(quantity.value)) || 0, 0),
              MAX_QUANTITY,
            );
            setQuantity(entry.id, wanted).catch(complain);
          });
          item
            .querySelector<HTMLButtonElement>('[data-line-remove]')!
            .addEventListener('click', () => {
              failure?.setAttribute('hidden', '');
              removeFromCart(entry.id).catch(complain);
            });
          return item;
        };

        const render = (cart: Cart | null) => {
          if (placed) return;
          failure?.setAttribute('hidden', '');
          const filled = (cart?.items.length ?? 0) > 0;
          list.replaceChildren(...(cart?.items ?? []).map(line));
          empty?.toggleAttribute('hidden', filled);
          summary?.toggleAttribute('hidden', !filled);
          checkout?.toggleAttribute('hidden', !filled);
          if (total && cart) total.textContent = formatPrice(cart.total, bcp47);
        };

        this.addEventListener(
          'order-placed',
          (event) => {
            placed = true;
            const { displayId } = (event as CustomEvent<{ displayId: number }>)
              .detail;
            for (const node of [list, empty, summary, checkout, failure])
              node?.setAttribute('hidden', '');
            const heading = placedPanel?.querySelector<HTMLElement>(
              '[data-placed-heading]',
            );
            if (heading)
              heading.textContent = (heading.dataset.template ?? '').replace(
                '{number}',
                String(displayId),
              );
            placedPanel?.removeAttribute('hidden');
          },
          { signal },
        );
        onCart(render, signal);
        render(currentCart());
        loadCart((this.dataset.locale ?? 'sr') as Locale).catch(complain);
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
