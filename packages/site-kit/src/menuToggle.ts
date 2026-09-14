import { lockScroll, unlockScroll } from './scrollLock.ts';
import { MODAL_OPEN_EVENT } from './modalDialog.ts';

export type MenuToggleElement = HTMLElement & {
  setMenuOpen(open: boolean): void;
};

export function defineMenuToggle(tagName = 'menu-toggle'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;
      private applyOpen?: (next: boolean) => void;

      setMenuOpen(next: boolean): void {
        this.applyOpen?.(next);
      }

      connectedCallback(): void {
        if (this.controller) return;
        const button =
          this.querySelector<HTMLButtonElement>('[data-menu-button]');
        const desktopMedia = this.dataset.desktopMedia;
        if (!button || !desktopMedia) return;

        this.controller = new AbortController();
        const { signal } = this.controller;
        const menu = this.querySelector<HTMLElement>('[data-menu]');
        const openLabel = button.getAttribute('aria-label') ?? '';
        const closeLabel = button.dataset.closeLabel ?? openLabel;
        const closeSelector = this.dataset.closeSelector ?? 'a';
        const locksScroll = this.hasAttribute('data-lock-scroll');

        menu?.toggleAttribute('inert', true);

        this.applyOpen = (next: boolean) => {
          if (next === this.hasAttribute('data-open')) return;
          this.toggleAttribute('data-open', next);
          button.setAttribute('aria-expanded', String(next));
          button.setAttribute('aria-label', next ? closeLabel : openLabel);
          menu?.toggleAttribute('inert', !next);
          if (!locksScroll) return;
          if (next) lockScroll();
          else unlockScroll();
        };

        button.addEventListener(
          'click',
          () => this.setMenuOpen(!this.hasAttribute('data-open')),
          { signal },
        );
        this.addEventListener(
          'click',
          (event) => {
            const target = event.target as HTMLElement;
            if (target !== button && target.closest(closeSelector))
              this.setMenuOpen(false);
          },
          { signal },
        );
        this.ownerDocument.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'Escape') this.setMenuOpen(false);
          },
          { signal },
        );
        this.ownerDocument.addEventListener(
          MODAL_OPEN_EVENT,
          () => this.setMenuOpen(false),
          { signal },
        );
        window.matchMedia(desktopMedia).addEventListener(
          'change',
          (event) => {
            if (event.matches) this.setMenuOpen(false);
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
        this.applyOpen?.(false);
        this.applyOpen = undefined;
      }
    },
  );
}
