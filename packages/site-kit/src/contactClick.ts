import { readOrCreateVisitorId } from './visitorId.ts';

const browserVisitorId = (): string =>
  readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });

const CHANNEL_ATTRIBUTE = 'data-contact-channel';
const CONTACT_CLICK_ENDPOINT = '/api/contact-click';

export function defineContactClickTracking(
  isTracked: (channel: string | undefined) => channel is string,
): void {
  document
    .querySelectorAll<HTMLElement>(`[${CHANNEL_ATTRIBUTE}]`)
    .forEach((element) => {
      element.addEventListener('click', () => {
        const channel = element.dataset.contactChannel;
        if (!isTracked(channel)) return;
        const body = new FormData();
        body.set('channel', channel);
        body.set('source_url', location.href);
        body.set('visitor_id', browserVisitorId());
        navigator.sendBeacon(CONTACT_CLICK_ENDPOINT, body);
        window.gtag?.('event', 'contact_click', { channel });
        window.ymReachGoal?.('contact_click', { channel });
      });
    });
}
