import type { Locale } from '@/i18n/config';
import { cartCount, currentCart, loadCart, onCart } from './cart';
import type { Cart } from './cartApi';

export function defineCartCount(tagName = 'cart-count'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        this.controller = new AbortController();
        const render = (cart: Cart | null) => {
          const count = cartCount(cart);
          this.textContent = String(count);
          this.hidden = count === 0;
          this.closest('a')?.setAttribute(
            'aria-label',
            `${this.dataset.label ?? ''}: ${count}`,
          );
        };
        onCart(render, this.controller.signal);
        render(currentCart());
        loadCart((this.dataset.locale ?? 'sr') as Locale).catch(
          (error: unknown) => console.warn('[cart] not loaded', error),
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
