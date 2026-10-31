import { storedVin } from '@podbor/site-kit/browser';
import { vinFrom } from '@/utils/carFacts';

const withLine = (href: string, line: string): string => {
  const url = new URL(href);
  const text = url.searchParams.get('text');
  url.search = `?text=${encodeURIComponent(text ? `${text}\n${line}` : line)}`;
  return url.toString();
};

export function defineVinPrefill(tagName = 'vin-prefill'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      connectedCallback(): void {
        const vin = vinFrom(location.search) || storedVin();
        if (!vin) return;
        const line = (this.dataset.template ?? '{vin}').replace('{vin}', vin);
        for (const link of this.querySelectorAll<HTMLAnchorElement>(
          '[data-contact-channel="whatsapp"]',
        )) {
          link.href = withLine(link.href, line);
        }
      }
    },
  );
}
