export type MapPlace = string | { lat: number; lon: number };

export function mapEmbedSrc(place: MapPlace): string {
  const query = typeof place === 'string' ? place : `${place.lat},${place.lon}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
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
