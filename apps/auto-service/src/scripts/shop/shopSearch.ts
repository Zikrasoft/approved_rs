interface PagefindHit {
  data(): Promise<{ url: string; meta: Record<string, string | undefined> }>;
}

export interface Pagefind {
  debouncedSearch(query: string): Promise<{ results: PagefindHit[] } | null>;
}

const MAX_RESULTS = 8;
const MIN_QUERY = 2;

export function defineShopSearch(
  tagName = 'shop-search',
  load: (url: string) => Promise<Pagefind> = (url) => import(url),
): void {
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
        const list = this.querySelector<HTMLElement>('[data-search-results]');
        if (!input || !list) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const empty = this.querySelector<HTMLElement>('[data-search-empty]');
        let api: Promise<Pagefind> | undefined;
        const ready = () =>
          (api ??= load(this.dataset.bundle ?? '/pagefind/pagefind.js'));

        const show = (
          hits: { url: string; meta: Record<string, string | undefined> }[],
        ) => {
          list.replaceChildren(
            ...hits.map((hit) => {
              const item = document.createElement('li');
              const link = document.createElement('a');
              link.href = hit.url;
              link.className =
                'flex min-h-11 items-center justify-between gap-3 border-b border-line py-2 text-sm text-ink';
              const title = document.createElement('span');
              title.textContent = hit.meta.title ?? '';
              const price = document.createElement('span');
              price.className = 'spec shrink-0 text-muted';
              price.textContent = hit.meta.price ?? '';
              link.append(title, price);
              item.append(link);
              return item;
            }),
          );
        };

        const search = async () => {
          const query = input.value.trim();
          if (query.length < MIN_QUERY) {
            show([]);
            empty?.setAttribute('hidden', '');
            return;
          }
          try {
            const found = await (await ready()).debouncedSearch(query);
            if (!found || input.value.trim() !== query) return;
            const hits = await Promise.all(
              found.results
                .slice(0, MAX_RESULTS)
                .map((result) => result.data()),
            );
            show(hits);
            empty?.toggleAttribute('hidden', hits.length > 0);
          } catch (error) {
            api = undefined;
            show([]);
            console.warn('[search] index unavailable', error);
          }
        };

        const warm = () => {
          ready().catch((error: unknown) => {
            api = undefined;
            console.warn('[search] index unavailable', error);
          });
        };
        this.addEventListener('focusin', warm, { signal, once: true });
        this.addEventListener('pointerenter', warm, { signal, once: true });
        input.addEventListener('input', () => void search(), { signal });
        this.querySelector('form')?.addEventListener(
          'submit',
          (event) => event.preventDefault(),
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
