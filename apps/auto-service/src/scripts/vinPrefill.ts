import { storedVin } from '@podbor/site-kit/browser';
import { appendWhatsappLine } from '@podbor/site-kit/contact-links';
import { vinFrom } from '@/utils/carFacts';

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
          link.href = appendWhatsappLine(link.href, line);
        }
      }
    },
  );
}
