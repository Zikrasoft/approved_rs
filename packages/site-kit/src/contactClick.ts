import { CONTACT_PLACEMENT_ATTRIBUTE, GOALS, reachGoal } from './goals.ts';
import { readOrCreateVisitorId } from './visitorId.ts';

const browserVisitorId = (): string =>
  readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });

const CHANNEL_ATTRIBUTE = 'data-contact-channel';
const CONTACT_CLICK_ENDPOINT = '/api/contact-click';

export const storesContactClickLead = (channel: string): boolean =>
  channel !== 'telegram';

export function defineContactClickTracking(
  isTracked: (channel: string | undefined) => channel is string,
  storesLead: (channel: string) => boolean,
): void {
  document
    .querySelectorAll<HTMLElement>(`[${CHANNEL_ATTRIBUTE}]`)
    .forEach((element) => {
      element.addEventListener('click', () => {
        const channel = element.dataset.contactChannel;
        if (!isTracked(channel)) return;
        const placement = element.closest<HTMLElement>(
          `[${CONTACT_PLACEMENT_ATTRIBUTE}]`,
        )?.dataset.contactPlacement;
        reachGoal(GOALS.contactClick, { channel, placement });
        if (!storesLead(channel)) return;
        const body = new FormData();
        body.set('channel', channel);
        body.set('source_url', location.href);
        body.set('visitor_id', browserVisitorId());
        navigator.sendBeacon(CONTACT_CLICK_ENDPOINT, body);
      });
    });
}
