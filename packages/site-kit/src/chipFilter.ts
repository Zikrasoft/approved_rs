const ALL_GROUPS = '*';

export function defineChipFilter(tagName = 'chip-filter'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const items = [
          ...this.querySelectorAll<HTMLElement>('[data-filter-item]'),
        ];
        if (items.length === 0) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const chips = [
          ...this.querySelectorAll<HTMLButtonElement>('[data-filter-chip]'),
        ];
        const more =
          this.querySelector<HTMLButtonElement>('[data-filter-more]');
        const cap = Number(this.dataset.cap);
        let expanded = false;
        let group =
          chips.find((chip) => chip.getAttribute('aria-pressed') === 'true')
            ?.dataset.group ?? ALL_GROUPS;

        const apply = () => {
          const capped = Number.isFinite(cap) && cap > 0 && !expanded;
          let shown = 0;
          for (const item of items) {
            const matches =
              group === ALL_GROUPS || item.dataset.group === group;
            if (matches) shown += 1;
            item.toggleAttribute('hidden', !matches || (capped && shown > cap));
          }
          if (more) {
            const rest = capped ? shown - cap : 0;
            more.toggleAttribute('hidden', rest <= 0);
            more.textContent = (more.dataset.template ?? '').replace(
              '{rest}',
              String(Math.max(rest, 0)),
            );
          }
        };

        more?.addEventListener(
          'click',
          () => {
            expanded = true;
            apply();
          },
          { signal },
        );
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
