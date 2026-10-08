export { detectVisitorCountry } from '@podbor/site-kit/contact-preference';

export {
  TRACKED_CONTACT_CHANNELS,
  isTrackedContactChannel,
  type TrackedContactChannel,
} from '@podbor/lead-crm/contact-channel';

export const DATA_LEAD_SERVICE = 'data-lead-service';
export const DATA_DEFAULT_SERVICE = 'data-default-service';
export const DATA_OPEN_LEAD_MODAL = 'data-open-lead-modal';
export const DATA_PAGE_LEAD_MODAL = 'data-page-lead-modal';

export function leadModalTrigger(channel: string | true = true) {
  return { [DATA_OPEN_LEAD_MODAL]: channel };
}

export function callbackTrigger() {
  return leadModalTrigger('phone');
}
