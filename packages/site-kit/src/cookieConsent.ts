import {
  CONSENT_EVENT,
  STORAGE_KEY,
  newConsent,
  parseConsent,
  type Consent,
  type ConsentDetail,
} from './consent.ts';
import { forgetVisitorId } from './visitorId.ts';

export { CONSENT_EVENT, type ConsentDetail };
const CONSENT_SETTINGS_ATTRIBUTE = 'data-cookie-settings';
const REVEAL_DELAY_MS = 6000;
const REVEAL_SCROLL_PX = 600;
const CONSENT_ACCEPT_ATTRIBUTE = 'data-consent-accept';
const CONSENT_DECLINE_ATTRIBUTE = 'data-consent-decline';

export function readConsent(version: string): Consent | null {
  try {
    return parseConsent(localStorage.getItem(STORAGE_KEY), version);
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean, version: string): Consent {
  const consent = newConsent(analytics, version, new Date());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Private mode or a full quota — the visitor simply gets asked again.
  }
  return consent;
}

export function defineCookieConsent(tagName = 'cookie-consent'): void {
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    class extends HTMLElement {
      private controller?: AbortController;

      connectedCallback(): void {
        // Node.moveBefore() reconnects without disconnecting, so without this
        // the previous listeners survive and one click answers twice.
        this.controller?.abort();
        this.controller = new AbortController();
        const { signal } = this.controller;
        const version = this.dataset.policyVersion ?? '';

        if (readConsent(version) !== null) this.hidden = true;
        else if (this.hidden) this.revealLater(version, signal);

        this.addEventListener(
          'click',
          (event) => {
            const button = (event.target as Element | null)?.closest(
              `[${CONSENT_ACCEPT_ATTRIBUTE}], [${CONSENT_DECLINE_ATTRIBUTE}]`,
            );
            if (!button) return;
            const analytics = button.hasAttribute(CONSENT_ACCEPT_ATTRIBUTE);
            saveConsent(analytics, version);
            if (!analytics) forgetVisitorId(localStorage);
            this.hidden = true;
            this.dispatchEvent(
              new CustomEvent<ConsentDetail>(CONSENT_EVENT, {
                detail: { analytics },
                bubbles: true,
              }),
            );
          },
          { signal },
        );

        document.addEventListener(
          'click',
          (event) => {
            const trigger = (event.target as Element | null)?.closest(
              `[${CONSENT_SETTINGS_ATTRIBUTE}]`,
            );
            if (!trigger) return;
            event.preventDefault();
            this.hidden = false;
          },
          { signal },
        );
      }

      private revealLater(version: string, signal: AbortSignal): void {
        const pending = new AbortController();
        signal.addEventListener('abort', () => pending.abort(), {
          signal: pending.signal,
        });

        const reveal = () => {
          pending.abort();
          if (readConsent(version) === null) this.hidden = false;
        };
        const timer = setTimeout(reveal, REVEAL_DELAY_MS);
        pending.signal.addEventListener('abort', () => clearTimeout(timer));
        window.addEventListener(
          'scroll',
          () => {
            if (window.scrollY >= REVEAL_SCROLL_PX) reveal();
          },
          { signal: pending.signal, passive: true },
        );
      }

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
