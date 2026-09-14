import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';

export {
  TRACKED_CONTACT_CHANNELS,
  isTrackedContactChannel,
  type TrackedContactChannel,
} from '@podbor/lead-crm/contact-channel';

export const DATA_CONTACT_CHANNEL = 'data-contact-channel';

export const DATA_OPEN_LEAD_MODAL = 'data-open-lead-modal';
export const DATA_OPEN_PAGE_LEAD_MODAL = 'data-open-page-lead-modal';

const PREFERRED_CHANNEL_BY_COUNTRY = new Map<string, TrackedContactChannel>([
  ['rs', 'whatsapp'],
  ['ba', 'whatsapp'],
  ['hr', 'whatsapp'],
  ['me', 'whatsapp'],
  ['mk', 'whatsapp'],
  ['tr', 'whatsapp'],
  ['de', 'whatsapp'],
  ['es', 'whatsapp'],
  ['pt', 'whatsapp'],
  ['ch', 'whatsapp'],
  ['fr', 'whatsapp'],
  ['it', 'whatsapp'],
  ['pl', 'whatsapp'],
  ['ru', 'telegram'],
  ['ua', 'telegram'],
  ['by', 'telegram'],
  ['kz', 'telegram'],
]);

export function getPreferredChannel(
  countryCode: string | undefined,
  locale?: string,
): TrackedContactChannel {
  if (locale === 'ru') return 'telegram';

  return (
    (countryCode &&
      PREFERRED_CHANNEL_BY_COUNTRY.get(countryCode.toLowerCase())) ||
    'telegram'
  );
}
