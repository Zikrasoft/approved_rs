export const FILTERS_OPEN_ATTRIBUTE = 'data-filters-open';
export const FILTERS_SUBMIT_ATTRIBUTE = 'data-filters-submit';
export const FILTERS_COUNT_ATTRIBUTE = 'data-filters-count';

const RECOUNT_DELAY_MS = 300;

export function defineFilterSheet(
  tagName = 'filter-sheet',
  wide = '(min-width: 64rem)',
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #wiring: AbortController | undefined;
      #recount: AbortController | undefined;
      #timer: ReturnType<typeof setTimeout> | undefined;

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
        const form = this.closest('form');
        this.addEventListener(
          'input',
          () => {
            this.toggleAttribute('data-dirty', true);
            if (submit && form) this.#schedule(form, submit);
          },
          { signal },
        );
        form?.addEventListener(
          'formdata',
          ({ formData }) => {
            const kept = [...formData].filter(([, value]) => value !== '');
            for (const name of new Set(formData.keys())) formData.delete(name);
            for (const [name, value] of kept) formData.append(name, value);
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
        this.#recount?.abort();
        clearTimeout(this.#timer);
      }

      #schedule(form: HTMLFormElement, submit: Element): void {
        const plain = submit.getAttribute(FILTERS_SUBMIT_ATTRIBUTE) ?? '';
        const template = submit.getAttribute(FILTERS_COUNT_ATTRIBUTE);
        const url = this.dataset.countUrl;
        this.#recount?.abort();
        clearTimeout(this.#timer);
        if (!template || !url) {
          submit.textContent = plain;
          return;
        }
        submit.setAttribute('aria-busy', 'true');
        const recount = new AbortController();
        this.#recount = recount;
        this.#timer = setTimeout(() => {
          const params = new URLSearchParams();
          for (const [name, value] of new FormData(form)) {
            if (typeof value === 'string' && value) params.append(name, value);
          }
          fetch(`${url}&${params}`, { signal: recount.signal })
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
            .then((body: { count?: unknown } | null) => {
              if (recount.signal.aborted) return;
              submit.removeAttribute('aria-busy');
              submit.textContent =
                typeof body?.count === 'number'
                  ? template.replace('{count}', String(body.count))
                  : plain;
            });
        }, RECOUNT_DELAY_MS);
      }
    },
  );
}
