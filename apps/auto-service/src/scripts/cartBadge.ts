import * as z from 'zod/mini';
import { readStoredJson } from '@podbor/site-kit/stored-value';
import { shopPreview } from './shopPreview';

export const CART_STORAGE_KEY = 'carlab_offer_cart';
export const CART_CHANGED_EVENT = 'carlab:cart-changed';

const countSchema = z.object({ count: z.number() });

export const cartCount = (storage?: Pick<Storage, 'getItem'>): number =>
  readStoredJson(CART_STORAGE_KEY, countSchema, null, storage)?.count ?? 0;

export function defineCartBadge(tagName = 'cart-badge'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        if (this.dataset.previewOnly !== undefined) {
          if (!shopPreview()) return;
          this.hidden = false;
        }
        const update = () => {
          const count = cartCount();
          const badge = this.querySelector<HTMLElement>('[data-count]');
          if (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
          }
          if (this.dataset.revealWhenFilled !== undefined) {
            this.hidden = count === 0;
          }
        };
        update();
        window.addEventListener('storage', update);
        window.addEventListener(CART_CHANGED_EVENT, update);
      }
    },
  );
}
