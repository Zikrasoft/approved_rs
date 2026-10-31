export const prerender = false;

import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { phoneLink, whatsappLink } from '@podbor/site-kit/contact-links';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { notifyLead } from '@/lib/crm';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { PHONE_NUMBER, WHATSAPP_NUMBER } from '@/utils/constants';
import { PathBuilder } from '@/utils/paths';

export const POST = createLeadsRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
  localeCookie: LOCALE_COOKIE,
  thanksPath: PathBuilder.thanks,
  refusalCopy: (locale) => {
    const { form, footer } = content(locale).site;
    return {
      reasons: {
        'missing-contact': form.errorTelegram,
        'invalid-phone': form.errorPhone,
        'invalid-telegram': form.errorTelegramHandle,
        'missing-consent': form.errorConsent,
      },
      consent: `${form.privacyNote} ${form.privacyLinkText}`,
      privacy: {
        label: footer.privacyLabel,
        href: PathBuilder.privacy(locale),
      },
      submit: form.submit,
      links: [
        { label: formatPhone(PHONE_NUMBER), href: phoneLink(PHONE_NUMBER) },
        { label: 'WhatsApp', href: whatsappLink(WHATSAPP_NUMBER) },
      ],
    };
  },
});
