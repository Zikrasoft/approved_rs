export function defineNotFoundParts(tagName = 'not-found-parts'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const { pathname, search, hash } = location;
        const lower = pathname.toLowerCase();
        const under = (paths = '', path = pathname) =>
          paths.split(' ').some((prefix) => prefix && path.startsWith(prefix));
        if (lower !== pathname && under(this.dataset.partPaths, lower)) {
          location.replace(`${lower}${search}${hash}`);
          return;
        }
        if (!under(this.dataset.partsPaths)) return;
        this.querySelector<HTMLElement>('[data-parts-404]')!.hidden = false;
        this.querySelector<HTMLElement>('[data-site-body]')!.hidden = true;
      }
    },
  );
}
