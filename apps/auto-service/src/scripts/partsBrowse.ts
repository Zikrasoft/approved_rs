export const PARTS_BROWSE_ATTRIBUTE = 'data-parts-browse';
export const PARTS_BROWSE_STATUS_ATTRIBUTE = 'data-parts-browse-status';

const PAGE_LINK = 'a[rel="prev"][href], a[rel="next"][href]';

type Navigate = (href: string) => void;

const browseBlockOf = async (href: string): Promise<Element | null> => {
  const response = await fetch(href, { headers: { accept: 'text/html' } });
  if (!response.ok) return null;
  return new DOMParser()
    .parseFromString(await response.text(), 'text/html')
    .querySelector(`[${PARTS_BROWSE_ATTRIBUTE}]`);
};

const plainClick = (event: MouseEvent) =>
  event.button === 0 &&
  !event.defaultPrevented &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const pageOf = (href: string) => {
  const { pathname, search } = new URL(href, window.location.href);
  return pathname + search;
};

export function definePartsBrowse(
  tagName = 'parts-browse',
  navigate: Navigate = (href) => window.location.assign(href),
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;
      private shown = '';

      constructor() {
        super();
        this.addEventListener('click', (event) => void this.turn(event));
      }

      connectedCallback() {
        this.shown = pageOf(window.location.href);
        this.controller = new AbortController();
        window.addEventListener('popstate', () => void this.restore(), {
          signal: this.controller.signal,
        });
      }

      disconnectedCallback() {
        this.controller?.abort();
        this.controller = undefined;
      }

      private async restore() {
        const href = window.location.href;
        if (pageOf(href) === this.shown) return;
        if (!(await this.show(href, false))) navigate(href);
      }

      private async turn(event: MouseEvent) {
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>(PAGE_LINK)
            : null;
        if (!link || !this.block() || !plainClick(event)) return;
        event.preventDefault();
        if (this.block()?.getAttribute('aria-busy') === 'true') return;
        if (!(await this.show(link.href, true))) {
          navigate(link.href);
          return;
        }
        window.history.pushState(null, '', link.href);
      }

      private block() {
        return this.querySelector(`[${PARTS_BROWSE_ATTRIBUTE}]`);
      }

      private async show(href: string, focus: boolean): Promise<boolean> {
        const block = this.block();
        if (!block) return true;
        block.setAttribute('aria-busy', 'true');
        const next = await browseBlockOf(href).catch(() => null);
        if (!next) return false;
        block.replaceWith(next);
        this.shown = pageOf(href);
        const live = this.querySelector('[aria-live]');
        if (live) {
          live.textContent = next.getAttribute(PARTS_BROWSE_STATUS_ATTRIBUTE);
        }
        if (focus) this.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
        return true;
      }
    },
  );
}
