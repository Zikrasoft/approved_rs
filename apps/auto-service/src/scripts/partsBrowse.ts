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

export function definePartsBrowse(
  tagName = 'parts-browse',
  navigate: Navigate = (href) => window.location.assign(href),
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      constructor() {
        super();
        this.addEventListener('click', (event) => void this.turn(event));
      }

      async turn(event: MouseEvent) {
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>(PAGE_LINK)
            : null;
        const block = this.querySelector(`[${PARTS_BROWSE_ATTRIBUTE}]`);
        if (!link || !block || !plainClick(event)) return;
        event.preventDefault();
        if (block.getAttribute('aria-busy') === 'true') return;
        block.setAttribute('aria-busy', 'true');
        const next = await browseBlockOf(link.href).catch(() => null);
        if (!next) {
          navigate(link.href);
          return;
        }
        block.replaceWith(next);
        const live = this.querySelector('[aria-live]');
        if (live) {
          live.textContent = next.getAttribute(PARTS_BROWSE_STATUS_ATTRIBUTE);
        }
        this.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
      }
    },
  );
}
