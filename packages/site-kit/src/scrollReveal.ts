const REVEAL_ATTRIBUTE = 'data-reveal';
const REVEALED_CLASS = 'is-in';
const NOTHING_SEEN_MS = 2000;

export function defineScrollReveal(tagName = 'scroll-reveal'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private observer?: IntersectionObserver;
      private fallback?: number;

      connectedCallback(): void {
        if (this.observer) return;
        const targets = [
          ...this.querySelectorAll<HTMLElement>(`[${REVEAL_ATTRIBUTE}]`),
        ];
        const revealAll = () =>
          targets.forEach((el) => el.classList.add(REVEALED_CLASS));

        if (
          matchMedia('(prefers-reduced-motion: reduce)').matches ||
          typeof IntersectionObserver === 'undefined'
        ) {
          revealAll();
          return;
        }

        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const el = entry.target as HTMLElement;
              setTimeout(
                () => el.classList.add(REVEALED_CLASS),
                Number(el.dataset.revealDelay ?? 0),
              );
              observer.unobserve(el);
            }
          },
          { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
        );
        targets.forEach((el) => observer.observe(el));
        this.observer = observer;
        this.fallback = window.setTimeout(() => {
          if (!targets.some((el) => el.classList.contains(REVEALED_CLASS)))
            revealAll();
        }, NOTHING_SEEN_MS);
      }

      disconnectedCallback(): void {
        this.observer?.disconnect();
        this.observer = undefined;
        clearTimeout(this.fallback);
      }
    },
  );
}
