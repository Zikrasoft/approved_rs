import { STOCK_EVENT, fetchStock, type StockDetail } from './stock';

const LOW_STOCK = 3;

export function defineStockStatus(tagName = 'stock-status'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private asked = false;

      connectedCallback(): void {
        const { handle, variant } = this.dataset;
        if (this.asked || !handle || !variant) return;
        this.asked = true;
        fetchStock(handle, variant)
          .then((quantity) => {
            const state =
              quantity === 0
                ? 'out'
                : quantity !== null && quantity <= LOW_STOCK
                  ? 'low'
                  : 'in';
            this.dataset.state = state;
            this.textContent =
              state === 'out'
                ? (this.dataset.out ?? '')
                : state === 'low'
                  ? (this.dataset.low ?? '').replace(
                      '{count}',
                      String(quantity),
                    )
                  : (this.dataset.in ?? '');
            window.dispatchEvent(
              new CustomEvent<StockDetail>(STOCK_EVENT, {
                detail: { variantId: variant, quantity },
              }),
            );
          })
          .catch((error: unknown) =>
            console.warn('[stock] keeping the baked availability', error),
          );
      }
    },
  );
}
