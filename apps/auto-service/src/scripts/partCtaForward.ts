export const PART_ADDED_EVENT = 'part-added';

export function definePartCtaForward(tagName = 'part-cta-forward'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #wiring: AbortController | undefined;

      connectedCallback(): void {
        if (this.#wiring) return;
        this.#wiring = new AbortController();
        this.addEventListener(
          'click',
          (event) => {
            const selector = this.dataset.to;
            const to = selector
              ? document.querySelector<HTMLElement>(selector)
              : null;
            if (!to || to.hidden) return;
            event.preventDefault();
            to.scrollIntoView({ block: 'center' });
            to.click();
          },
          { signal: this.#wiring.signal },
        );
        document.addEventListener(PART_ADDED_EVENT, () => this.toCart(), {
          signal: this.#wiring.signal,
        });
      }

      toCart(): void {
        const link = this.querySelector('a');
        if (!link) return;
        delete this.dataset.to;
        link.href = this.dataset.cartHref ?? link.href;
        link.textContent = this.dataset.addedLabel ?? link.textContent;
      }

      disconnectedCallback(): void {
        this.#wiring?.abort();
        this.#wiring = undefined;
      }
    },
  );
}
