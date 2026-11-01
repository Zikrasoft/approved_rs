export const FILTERS_OPEN_ATTRIBUTE = 'data-filters-open';
export const FILTERS_SUBMIT_ATTRIBUTE = 'data-filters-submit';
export const FILTERS_COUNT_ATTRIBUTE = 'data-filters-count';
export const FILTERS_NONE_ATTRIBUTE = 'data-filters-none';
export const FACET_COUNT_ATTRIBUTE = 'data-facet-count';

type ValueCounts = Record<string, Record<string, number>>;

const edited = (form: HTMLFormElement) =>
  [...form.querySelectorAll('input')].some(
    (input) =>
      input.checked !== input.defaultChecked ||
      input.value !== input.defaultValue,
  );

const markInvalid = (sheet: HTMLElement) => {
  const invalid = [...sheet.querySelectorAll('input')].filter(
    (input) => !input.validity.valid,
  );
  for (const input of sheet.querySelectorAll('input')) {
    if (invalid.includes(input)) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  return invalid.length > 0;
};

const patchValues = (sheet: HTMLElement, facets: ValueCounts) => {
  for (const input of sheet.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )) {
    const split = input.value.indexOf(':');
    const values = facets[input.value.slice(0, split)];
    if (!values) continue;
    const count = values[input.value.slice(split + 1)] ?? 0;
    const label = input
      .closest('label')
      ?.querySelector(`[${FACET_COUNT_ATTRIBUTE}]`);
    if (label) label.textContent = String(count);
    input.disabled = count === 0 && !input.checked;
  }
};

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
        window.addEventListener(
          'pageshow',
          () => {
            if (!form || (!this.hasAttribute('data-dirty') && !edited(form)))
              return;
            form.reset();
            this.removeAttribute('data-dirty');
            if (submit) this.#schedule(form, submit);
          },
          { signal },
        );
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
        submit.textContent = plain;
        submit.toggleAttribute('disabled', false);
        submit.removeAttribute('aria-busy');
        if (markInvalid(this) || !template || !url) return;
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
            .then((body: { count?: unknown; facets?: ValueCounts } | null) => {
              if (recount.signal.aborted) return;
              submit.removeAttribute('aria-busy');
              const count = typeof body?.count === 'number' ? body.count : null;
              const none = submit.getAttribute(FILTERS_NONE_ATTRIBUTE);
              submit.textContent =
                count === null
                  ? plain
                  : count === 0 && none
                    ? none
                    : template.replace('{count}', String(count));
              submit.toggleAttribute('disabled', count === 0 && Boolean(none));
              if (body?.facets) patchValues(this, body.facets);
            });
        }, RECOUNT_DELAY_MS);
      }
    },
  );
}
