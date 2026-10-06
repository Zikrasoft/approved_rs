import { CONTACT_PLACEMENT_ATTRIBUTE, GOALS, reachGoal } from './goals.ts';
import { stampStartVisitor } from './contactLinks.ts';
import { readOrCreateVisitorId } from './visitorId.ts';

const browserVisitorId = (): string =>
  readOrCreateVisitorId({
    storage: localStorage,
    randomId: () => crypto.randomUUID(),
  });

const CHANNEL_ATTRIBUTE = 'data-contact-channel';
const CONTACT_CLICK_ENDPOINT = '/api/contact-click';
const START_PARAM = 'start';

export function defineContactClickTracking(
  isTracked: (channel: string | undefined) => channel is string,
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
        const visitorId = browserVisitorId();
        let start: string | null = null;
        if (element instanceof HTMLAnchorElement) {
          const url = new URL(element.href);
          start = url.searchParams.get(START_PARAM);
          if (start != null) {
            const stamped = stampStartVisitor(start, visitorId);
            if (!stamped) return;
            url.searchParams.set(START_PARAM, stamped);
            element.href = url.href;
          }
        }
        if (channel === 'telegram' && start == null) return;
        const body = new FormData();
        body.set('channel', channel);
        body.set('source_url', location.href);
        body.set('visitor_id', visitorId);
        navigator.sendBeacon(CONTACT_CLICK_ENDPOINT, body);
      });
    });
}
