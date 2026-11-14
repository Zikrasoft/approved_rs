const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

export function defineListSearch(tagName = 'list-search'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const input = this.querySelector<HTMLInputElement>(
          '[data-search-input]',
        );
        if (!input) return;

        this.controller = new AbortController();
        const items = [
          ...this.querySelectorAll<HTMLElement>('[data-search-item]'),
        ].map((item) => ({
          item,
          text: folded(item.textContent ?? ''),
          resting: item.hidden,
        }));
        const empty = this.querySelector<HTMLElement>('[data-search-empty]');
        const idle = [
          ...this.querySelectorAll<HTMLElement>('[data-search-idle]'),
        ];

        input.addEventListener(
          'input',
          () => {
            const query = folded(input.value);
            let matched = 0;
            for (const { item, text, resting } of items) {
              const shown = query ? text.includes(query) : !resting;
              if (shown) matched += 1;
              item.hidden = !shown;
            }
            for (const element of idle) element.hidden = Boolean(query);
            if (empty) empty.hidden = !query || matched > 0;
          },
          { signal: this.controller.signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
