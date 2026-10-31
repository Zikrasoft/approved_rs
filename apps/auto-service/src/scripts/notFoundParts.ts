export function defineNotFoundParts(tagName = 'not-found-parts'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const prefixes = (this.dataset.partsPaths ?? '').split(' ');
        if (
          !prefixes.some((path) => path && location.pathname.startsWith(path))
        )
          return;
        this.querySelector<HTMLElement>('[data-parts-404]')!.hidden = false;
        this.querySelector<HTMLElement>('[data-site-body]')!.hidden = true;
      }
    },
  );
}
