import { lockScroll, unlockScroll } from './scrollLock.ts';

export function defineMenuToggle(tagName = 'menu-toggle'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        if (this.controller) return;
        const button =
          this.querySelector<HTMLButtonElement>('[data-menu-button]');
        const desktopMedia = this.dataset.desktopMedia;
        if (!button || !desktopMedia) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const openLabel = button.getAttribute('aria-label') ?? '';
        const closeLabel = button.dataset.closeLabel ?? openLabel;
        const closeSelector = this.dataset.closeSelector ?? 'a';

        const setOpen = (next: boolean) => {
          if (next === this.hasAttribute('data-open')) return;
          this.toggleAttribute('data-open', next);
          button.setAttribute('aria-expanded', String(next));
          button.setAttribute('aria-label', next ? closeLabel : openLabel);
          if (next) lockScroll();
          else unlockScroll();
        };

        button.addEventListener(
          'click',
          () => setOpen(!this.hasAttribute('data-open')),
          { signal },
        );
        this.addEventListener(
          'click',
          (event) => {
            const target = event.target as HTMLElement;
            if (target !== button && target.closest(closeSelector))
              setOpen(false);
          },
          { signal },
        );
        this.ownerDocument.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Escape') setOpen(false);
          },
          { signal },
        );
        window.matchMedia(desktopMedia).addEventListener(
          'change',
          (event) => {
            if (event.matches) setOpen(false);
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
        if (this.hasAttribute('data-open')) {
          this.removeAttribute('data-open');
          unlockScroll();
        }
      }
    },
  );
}
