import { GOALS, reachGoal } from '@podbor/site-kit/browser';
import type { Locale } from '@/i18n/config';
import { addToCart } from './cart';
import { isOutOfStock } from './cartApi';
import { STOCK_EVENT, type StockDetail } from './stock';

export function defineAddToCart(tagName = 'add-to-cart'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const button = this.querySelector<HTMLButtonElement>('[data-add]');
        const { region, variant, type, locale } = this.dataset;
        if (!button || !region || !variant || !type || !locale) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const label = this.querySelector<HTMLElement>('[data-label]');
        const message = this.querySelector<HTMLElement>('[data-message]');
        const goCart = this.querySelector<HTMLElement>('[data-go-cart]');
        const install = this.querySelector<HTMLInputElement>(
          '[data-install-toggle]',
        );
        let busy = false;

        const add = (variantId: string) =>
          addToCart({
            regionId: region,
            locale: locale as Locale,
            preview: this.hasAttribute('data-preview'),
            variantId,
          });

        const say = (text: string | undefined) => {
          if (!message) return;
          message.textContent = text ?? '';
          message.hidden = !text;
        };

        button.addEventListener(
          'click',
          async () => {
            if (busy) return;
            busy = true;
            button.disabled = true;
            say(undefined);
            try {
              await add(variant);
              const installVariant = this.dataset.installVariant;
              if (install?.checked && installVariant) await add(installVariant);
              if (label) label.textContent = this.dataset.addedLabel ?? '';
              if (goCart) goCart.hidden = false;
              reachGoal(GOALS.addToCart, { type });
            } catch (error) {
              say(
                isOutOfStock(error)
                  ? this.dataset.soldOutLabel
                  : this.dataset.errorLabel,
              );
            } finally {
              busy = false;
              button.disabled = false;
            }
          },
          { signal },
        );

        window.addEventListener(
          STOCK_EVENT,
          (event) => {
            const { variantId, quantity } = (event as CustomEvent<StockDetail>)
              .detail;
            if (variantId === variant) button.disabled = quantity === 0;
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
