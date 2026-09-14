export interface ZoneMapOptions {
  // 0 turns the walkthrough off and leaves the map click-only.
  interval?: number;
}

export function defineZoneMap(
  tagName = 'zone-map',
  { interval = 5000 }: ZoneMapOptions = {},
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;
      private observer?: IntersectionObserver;
      private timer?: ReturnType<typeof setInterval>;

      connectedCallback(): void {
        if (this.controller) return;
        const buttons = [
          ...this.querySelectorAll<HTMLButtonElement>('[data-zone]'),
        ];
        if (buttons.length === 0) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const panels = [
          ...this.querySelectorAll<HTMLElement>('[data-zone-panel]'),
        ];

        let index = 0;

        const select = (zone: string | undefined) => {
          for (const button of buttons)
            button.setAttribute(
              'aria-pressed',
              String(button.dataset.zone === zone),
            );
          for (const panel of panels)
            panel.toggleAttribute('hidden', panel.dataset.zonePanel !== zone);
        };

        const stop = () => {
          clearInterval(this.timer);
          this.timer = undefined;
        };

        // A visitor who picks a zone is reading it; the walkthrough does not
        // get to pull the text out from under them again.
        let handedOver =
          interval <= 0 ||
          globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
            .matches === true;

        const start = () => {
          if (handedOver || this.timer) return;
          this.timer = setInterval(() => {
            index = (index + 1) % buttons.length;
            select(buttons[index].dataset.zone);
          }, interval);
        };

        for (const button of buttons)
          button.addEventListener(
            'click',
            () => {
              handedOver = true;
              stop();
              index = buttons.indexOf(button);
              select(button.dataset.zone);
            },
            { signal },
          );

        this.addEventListener('pointerenter', stop, { signal });
        this.addEventListener('focusin', stop, { signal });
        this.addEventListener('pointerleave', start, { signal });
        this.addEventListener('focusout', start, { signal });

        const preselected = buttons.find(
          (button) => button.getAttribute('aria-pressed') === 'true',
        );
        index = preselected ? buttons.indexOf(preselected) : 0;
        select(buttons[index].dataset.zone);

        // Off-screen it would swap text nobody is reading, so it only runs
        // while the map is actually in view.
        this.observer = new IntersectionObserver(([entry]) => {
          if (entry?.isIntersecting) start();
          else stop();
        });
        this.observer.observe(this);
      }

      disconnectedCallback(): void {
        clearInterval(this.timer);
        this.timer = undefined;
        this.observer?.disconnect();
        this.observer = undefined;
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
