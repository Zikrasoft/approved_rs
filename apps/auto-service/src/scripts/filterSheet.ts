export const FILTERS_OPEN_ATTRIBUTE = 'data-filters-open';
export const FILTERS_SUBMIT_ATTRIBUTE = 'data-filters-submit';

export function defineFilterSheet(
  tagName = 'filter-sheet',
  wide = '(min-width: 64rem)',
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #wiring: AbortController | undefined;

      connectedCallback(): void {
        this.#wiring = new AbortController();
        const { signal } = this.#wiring;
        const details = this.querySelector(':scope > details');
        if (details instanceof HTMLDetailsElement) details.open = true;
        for (const trigger of document.querySelectorAll<HTMLElement>(
          `[${FILTERS_OPEN_ATTRIBUTE}]`,
        )) {
          trigger.hidden = false;
        }
        const submit = this.querySelector(`[${FILTERS_SUBMIT_ATTRIBUTE}]`);
        this.addEventListener(
          'change',
          () => {
            this.toggleAttribute('data-dirty', true);
            const label = submit?.getAttribute(FILTERS_SUBMIT_ATTRIBUTE);
            if (submit && label) submit.textContent = label;
          },
          { signal },
        );
        const media = matchMedia(wide);
        media.addEventListener(
          'change',
          () => {
            if (media.matches) this.querySelector('dialog')?.close();
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.#wiring?.abort();
      }
    },
  );
}
