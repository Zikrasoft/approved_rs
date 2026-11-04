export function definePartGallery(tagName = 'part-gallery'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const main = this.querySelector<HTMLImageElement>('[data-main]');
        const thumbs = [
          ...this.querySelectorAll<HTMLAnchorElement>('a[data-thumb]'),
        ];
        if (!main) return;
        for (const thumb of thumbs) {
          thumb.addEventListener('click', (event) => {
            event.preventDefault();
            main.srcset = thumb.dataset.srcset ?? '';
            main.src = thumb.href;
            for (const other of thumbs) {
              other.removeAttribute('aria-current');
            }
            thumb.setAttribute('aria-current', 'true');
          });
        }
      }
    },
  );
}
