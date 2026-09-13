import { lockScroll, unlockScroll } from './scrollLock.ts';

export const MODAL_OPEN_EVENT = 'modal:open';

export interface ModalOpenDetail {
  trigger: HTMLElement;
}

export function defineModalDialog(tagName = 'modal-dialog'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #wiring: AbortController | undefined;
      #locked = false;

      connectedCallback(): void {
        const dialog = this.querySelector('dialog');
        if (!dialog) return;

        this.#wiring = new AbortController();
        const { signal } = this.#wiring;

        const triggerSelector = this.getAttribute('trigger');
        if (triggerSelector) {
          document.addEventListener(
            'click',
            (event) => {
              const target = event.target;
              const trigger =
                target instanceof Element
                  ? target.closest<HTMLElement>(triggerSelector)
                  : null;
              if (!trigger || dialog.open) return;
              event.preventDefault();
              dialog.showModal();
              this.#hold(true);
              this.dispatchEvent(
                new CustomEvent<ModalOpenDetail>(MODAL_OPEN_EVENT, {
                  bubbles: true,
                  detail: { trigger },
                }),
              );
            },
            { signal },
          );
        }

        dialog.addEventListener(
          'click',
          (event) => {
            const target = event.target as Element;
            if (target === dialog || target.closest('[data-modal-close]'))
              dialog.close();
          },
          { signal },
        );

        dialog.addEventListener('toggle', () => this.#hold(dialog.open), {
          signal,
        });
        dialog.addEventListener('close', () => this.#hold(false), { signal });
      }

      disconnectedCallback(): void {
        this.#wiring?.abort();
        this.#wiring = undefined;
        this.#hold(false);
      }

      #hold(next: boolean): void {
        if (next === this.#locked) return;
        this.#locked = next;
        if (next) lockScroll();
        else unlockScroll();
      }
    },
  );
}
