export function defineCtaReveal(tagName = 'cta-reveal'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private observer?: IntersectionObserver;
      private seen = new Map<Element, boolean>();

      private reveal(revealed: boolean): void {
        this.dataset.revealed = String(revealed);
        this.toggleAttribute('inert', !revealed);
      }

      connectedCallback(): void {
        if (this.observer) return;

        const selector = this.getAttribute('watch');
        const watched = selector
          ? [...document.querySelectorAll<HTMLElement>(selector)]
          : [];

        if (
          watched.length === 0 ||
          typeof IntersectionObserver === 'undefined'
        ) {
          this.reveal(true);
          return;
        }

        this.reveal(false);
        this.observer = new IntersectionObserver((entries) => {
          for (const entry of entries)
            this.seen.set(entry.target, entry.isIntersecting);
          this.reveal(![...this.seen.values()].some(Boolean));
        });
        for (const target of watched) this.observer.observe(target);
      }

      disconnectedCallback(): void {
        this.observer?.disconnect();
        this.observer = undefined;
        this.seen.clear();
      }
    },
  );
}
