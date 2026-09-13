import type { SiteContent } from '@/i18n/content/site';
import {
  PHONE_NUMBER,
  TELEGRAM_ENABLED,
  TG_MANAGER,
  VIBER_NUMBER,
  WHATSAPP_NUMBER,
} from './constants';

export const CONTACT_LINKS = {
  phone: `tel:+${PHONE_NUMBER}`,
  whatsapp: `https://wa.me/${WHATSAPP_NUMBER}`,
  viber: `viber://chat?number=%2B${VIBER_NUMBER}`,
  telegram: `https://t.me/${TG_MANAGER}`,
} as const;

export const contactChannels = (site: SiteContent) =>
  (
    [
      {
        href: CONTACT_LINKS.phone,
        icon: 'phone',
        label: site.channels.call,
        track: 'phone',
      },
      {
        href: CONTACT_LINKS.whatsapp,
        icon: 'whatsapp',
        label: site.channels.whatsapp,
        track: 'whatsapp',
      },
      {
        href: CONTACT_LINKS.viber,
        icon: 'viber',
        label: site.channels.viber,
        track: 'viber',
      },
      {
        href: CONTACT_LINKS.telegram,
        icon: 'telegram',
        label: site.channels.telegram,
        track: 'telegram',
      },
    ] as const
  ).filter((channel) => TELEGRAM_ENABLED || channel.track !== 'telegram');
