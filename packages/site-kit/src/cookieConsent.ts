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

        this.hidden = readConsent(version) !== null;

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

      disconnectedCallback(): void {
        this.controller?.abort();
        this.controller = undefined;
      }
    },
  );
}
