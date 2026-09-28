export function mapPlaceUrl(cid: string): string {
  return `https://maps.google.com/?cid=${encodeURIComponent(cid)}`;
}

export function mapEmbedSrc(cid: string): string {
  return `https://www.google.com/maps?cid=${encodeURIComponent(cid)}&output=embed`;
}

export function defineLazyMapEmbed(tagName = 'lazy-map-embed'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        new IntersectionObserver(
          ([entry], observer) => {
            if (!entry?.isIntersecting) return;
            const iframe = document.createElement('iframe');
            iframe.src = this.dataset.src ?? '';
            iframe.title = this.dataset.title ?? '';
            iframe.className = this.dataset.iframeClass ?? '';
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.loading = 'lazy';
            iframe.referrerPolicy = 'no-referrer-when-downgrade';
            this.replaceChildren(iframe);
            observer.disconnect();
          },
          { rootMargin: '200px' },
        ).observe(this);
      }
    },
  );
}
