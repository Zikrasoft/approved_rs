export type ListSearchEntry = {
  name: string;
  href: string;
  picture?: string | null;
};

const folded = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

function rendered(
  template: HTMLTemplateElement,
  { name, href, picture }: ListSearchEntry,
): DocumentFragment {
  const item = template.content.cloneNode(true) as DocumentFragment;
  for (const element of item.querySelectorAll('[data-search-name]')) {
    element.textContent = name;
  }
  item.querySelector('[data-search-href]')?.setAttribute('href', href);
  const image = item.querySelector('[data-search-picture]');
  if (picture) {
    image?.setAttribute('src', picture);
    item.querySelector('[data-search-no-picture]')?.remove();
  } else {
    image?.remove();
  }
  return item;
}

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
        const results = this.querySelector<HTMLElement>(
          '[data-search-results]',
        );
        const template = this.querySelector<HTMLTemplateElement>(
          'template[data-search-template]',
        );
        const index = this.querySelector('script[data-search-index]');
        if (!input || !results || !template || !index) return;

        this.controller = new AbortController();
        const entries = (
          JSON.parse(index.textContent || '[]') as ListSearchEntry[]
        ).map((entry) => ({ entry, text: folded(entry.name) }));
        const empty = this.querySelector<HTMLElement>('[data-search-empty]');
        const status = this.querySelector<HTMLElement>('[data-search-status]');
        const idle = [
          ...this.querySelectorAll<HTMLElement>('[data-search-idle]'),
        ];

        input.addEventListener(
          'input',
          () => {
            const query = folded(input.value);
            const matches = query
              ? entries.filter(({ text }) => text.includes(query))
              : [];
            results.replaceChildren(
              ...matches.map(({ entry }) => rendered(template, entry)),
            );
            results.hidden = !query;
            for (const element of idle) element.hidden = Boolean(query);
            const nothing = Boolean(query) && matches.length === 0;
            if (empty) empty.hidden = !nothing;
            if (status) {
              status.textContent = nothing
                ? (empty?.textContent?.trim() ?? '')
                : '';
            }
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
