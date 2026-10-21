import * as z from 'zod/mini';

export const CART_STORAGE_KEY = 'carlab_offer_cart';
export const CART_CHANGED_EVENT = 'carlab:cart-changed';

const countSchema = z.object({ count: z.number() });

export function cartCount(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const parsed = countSchema.safeParse(
      JSON.parse((storage ?? localStorage).getItem(CART_STORAGE_KEY) ?? 'null'),
    );
    return parsed.success ? parsed.data.count : 0;
  } catch {
    return 0;
  }
}

export function defineCartBadge(tagName = 'cart-badge'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
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
