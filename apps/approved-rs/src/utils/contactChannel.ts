export { detectVisitorCountry } from '@podbor/site-kit/contact-preference';

import { OPEN_LEAD_MODAL_ATTRIBUTE } from '@podbor/site-kit/lead-form';

export {
  DEFAULT_SERVICE_ATTRIBUTE as DATA_DEFAULT_SERVICE,
  LEAD_SERVICE_ATTRIBUTE as DATA_LEAD_SERVICE,
  OPEN_LEAD_MODAL_ATTRIBUTE as DATA_OPEN_LEAD_MODAL,
  PAGE_LEAD_MODAL_ATTRIBUTE as DATA_PAGE_LEAD_MODAL,
} from '@podbor/site-kit/lead-form';

export function leadModalTrigger(channel: string | true = true) {
  return { [OPEN_LEAD_MODAL_ATTRIBUTE]: channel };
}

export function callbackTrigger() {
  return leadModalTrigger('phone');
}
