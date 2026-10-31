export function defineLightbox(tagName = 'gallery-lightbox'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      #wiring: AbortController | undefined;

      connectedCallback(): void {
        if (this.#wiring) return;
        const dialog = this.querySelector('dialog');
        const view = dialog?.querySelector<HTMLImageElement>(
          '[data-lightbox-image]',
        );
        const items = [
          ...this.querySelectorAll<HTMLElement>('[data-lightbox-item]'),
        ];
        if (!dialog || !view || items.length === 0) return;

        this.#wiring = new AbortController();
        const { signal } = this.#wiring;
        let current = 0;

        const show = (next: number) => {
          current = (next + items.length) % items.length;
          view.src = items[current].dataset.src ?? '';
          view.alt = items[current].dataset.alt ?? '';
        };

        items.forEach((item, index) =>
          item.addEventListener(
            'click',
            () => {
              show(index);
              dialog.showModal();
            },
            { signal },
          ),
        );
        dialog.addEventListener(
          'click',
          (event) => {
            const target = event.target as Element;
            if (target.closest('[data-prev]')) show(current - 1);
            else if (target.closest('[data-next]')) show(current + 1);
          },
          { signal },
        );
        dialog.addEventListener(
          'keydown',
          (event) => {
            if (event.key === 'ArrowLeft') show(current - 1);
            if (event.key === 'ArrowRight') show(current + 1);
          },
          { signal },
        );
      }

      disconnectedCallback(): void {
        this.#wiring?.abort();
        this.#wiring = undefined;
      }
    },
  );
}
