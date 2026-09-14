export function defineCtaReveal(tagName = 'cta-reveal'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private observer?: IntersectionObserver;
      private seen = new Map<Element, boolean>();

      connectedCallback(): void {
        if (this.observer) return;

        const selector = this.getAttribute('watch');
        const watched = selector
          ? [...document.querySelectorAll<HTMLElement>(selector)]
          : [];

        // A contact affordance a markup typo could hide forever is worse than
        // one that shows too early, so nothing to watch means revealed.
        if (
          watched.length === 0 ||
          typeof IntersectionObserver === 'undefined'
        ) {
          this.dataset.revealed = 'true';
          return;
        }

        this.dataset.revealed = 'false';
        this.observer = new IntersectionObserver((entries) => {
          for (const entry of entries)
            this.seen.set(entry.target, entry.isIntersecting);
          this.dataset.revealed = String(
            ![...this.seen.values()].some(Boolean),
          );
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
