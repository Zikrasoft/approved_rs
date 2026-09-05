import { detectVisitorCountry } from './visitorCountry';
import { getPreferredChannel } from './contactChannel';

// Client-side only. Shared by every "[data-primary-contact]" group on the
// page (RegionalContactButton.astro, Footer.astro's brand contact row) —
// each group holds 2+ elements tagged data-primary-channel="telegram" /
// "whatsapp", one visible by default (the SSR fallback, Telegram) and the
// rest hidden. This shows whichever one matches the visitor's region and
// hides the others — one detector, one toggle, reused by every caller
// instead of each component re-implementing its own version of this.
// Safe to call once per page regardless of how many groups are present.
export function applyRegionalContactPreference(): void {
  const channel = getPreferredChannel(
    detectVisitorCountry(),
    document.documentElement.lang,
  );
  document
    .querySelectorAll<HTMLElement>('[data-primary-contact]')
    .forEach((group) => {
      group
        .querySelectorAll<HTMLElement>('[data-primary-channel]')
        .forEach((el) => {
          el.hidden = el.dataset.primaryChannel !== channel;
        });
    });
}
