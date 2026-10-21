export function defineOpenAtLarge(
  tagName = 'open-at-large',
  media = '(min-width: 64rem)',
): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        if (!matchMedia(media).matches) return;
        for (const details of this.querySelectorAll('details')) {
          details.open = true;
        }
      }
    },
  );
}
