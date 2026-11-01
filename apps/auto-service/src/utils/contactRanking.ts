import type { TrackedContactChannel } from '@podbor/lead-crm/contact-channel';
import type { ContactRanking } from '@podbor/site-kit/contact-preference';

const TELEGRAM_FIRST: readonly TrackedContactChannel[] = [
  'telegram',
  'phone',
  'whatsapp',
  'viber',
];

export const CONTACT_RANKING: ContactRanking = {
  byCountry: new Map(
    ['ru', 'ua', 'by', 'kz'].map((country) => [country, TELEGRAM_FIRST]),
  ),
  fallback: ['phone', 'whatsapp', 'viber', 'telegram'],
};
