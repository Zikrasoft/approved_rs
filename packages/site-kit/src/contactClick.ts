import { GOALS, reachGoal } from './goals.ts';
import { readOrCreateVisitorId } from './visitorId.ts';

const browserVisitorId = (): string =>
  readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });

const CHANNEL_ATTRIBUTE = 'data-contact-channel';
const CONTACT_CLICK_ENDPOINT = '/api/contact-click';

export interface ContactClickOptions {
  isTracked: (channel: string | undefined) => channel is string;
  opensLeadForm?: (element: HTMLElement) => boolean;
}

export function defineContactClickTracking({
  isTracked,
  opensLeadForm,
}: ContactClickOptions): void {
  document
    .querySelectorAll<HTMLElement>(`[${CHANNEL_ATTRIBUTE}]`)
    .forEach((element) => {
      element.addEventListener('click', () => {
        const channel = element.dataset.contactChannel;
        reachGoal(GOALS.contactClick, { channel });
        if (!isTracked(channel) || opensLeadForm?.(element)) return;
        const body = new FormData();
        body.set('channel', channel);
        body.set('source_url', location.href);
        body.set('visitor_id', browserVisitorId());
        navigator.sendBeacon(CONTACT_CLICK_ENDPOINT, body);
      });
    });
}
