const failed = (image: HTMLImageElement) =>
  image.complete && image.naturalWidth === 0 && image.hasAttribute('src');

export function definePartImage(tagName = 'part-image'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const image = this.querySelector('img');
        if (!image) return;
        image.addEventListener('error', () =>
          this.toggleAttribute('data-broken', true),
        );
        image.addEventListener('load', () =>
          this.removeAttribute('data-broken'),
        );
        this.toggleAttribute('data-broken', failed(image));
      }
    },
  );
}
