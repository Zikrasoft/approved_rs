const ALL_GROUPS = '*';

// One card per row on a phone turns a six-card catalogue into a six-screen
// scroll, so a narrow viewport gets the first few and a button for the rest.
const NARROW = '(max-width: 639px)';

export function defineRangeFilter(tagName = 'range-filter'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const range = this.querySelector<HTMLInputElement>('[data-range]');
        const items = [
          ...this.querySelectorAll<HTMLElement>('[data-filter-item]'),
        ];
        if (!range || items.length === 0) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const chips = [
          ...this.querySelectorAll<HTMLButtonElement>('[data-filter-chip]'),
        ];
        const output = this.querySelector<HTMLElement>('[data-range-output]');
        const count = this.querySelector<HTMLElement>('[data-filter-count]');
        const empty = this.querySelector<HTMLElement>('[data-filter-empty]');
        const more =
          this.querySelector<HTMLButtonElement>('[data-filter-more]');
        const cap = Number(this.dataset.cap);
        const narrow = globalThis.matchMedia?.(NARROW);
        let expanded = false;
        const format = new Intl.NumberFormat(this.dataset.locale || undefined);
        const suffix = this.dataset.suffix ?? '';
        let group =
          chips.find((chip) => chip.getAttribute('aria-pressed') === 'true')
            ?.dataset.group ?? ALL_GROUPS;

        const apply = () => {
          const ceiling = Number(range.value);
          const capped =
            Number.isFinite(cap) && cap > 0 && !expanded && narrow?.matches;
          let shown = 0;
          for (const item of items) {
            // An item whose amount isn't a number has no amount at all, so no
            // ceiling excludes it. Comparing NaN would hide it at every
            // setting instead, which reads as the item having been lost.
            const amount = Number(item.dataset.amount);
            const matches =
              (!Number.isFinite(amount) || amount <= ceiling) &&
              (group === ALL_GROUPS || item.dataset.group === group);
            if (matches) shown += 1;
            item.toggleAttribute(
              'hidden',
              !matches || (capped === true && shown > cap),
            );
          }
          if (more) {
            const rest = capped === true ? shown - cap : 0;
            more.toggleAttribute('hidden', rest <= 0);
            more.textContent = (more.dataset.template ?? '').replace(
              '{rest}',
              format.format(Math.max(rest, 0)),
            );
          }
          if (output) output.textContent = format.format(ceiling) + suffix;
          if (count)
            count.textContent = (count.dataset.template ?? '')
              .replace('{shown}', format.format(shown))
              .replace('{total}', format.format(items.length));
          empty?.toggleAttribute('hidden', shown > 0);
        };

        range.addEventListener('input', apply, { signal });
        more?.addEventListener(
          'click',
          () => {
            expanded = true;
            apply();
          },
          { signal },
        );
        // Rotating a phone into landscape crosses the breakpoint, and the cap
        // has to let go of the cards the wider grid is now showing.
        narrow?.addEventListener('change', apply, { signal });
        for (const chip of chips)
          chip.addEventListener(
            'click',
            () => {
              group = chip.dataset.group ?? ALL_GROUPS;
              for (const other of chips)
                other.setAttribute('aria-pressed', String(other === chip));
              apply();
            },
            { signal },
          );

        apply();
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
