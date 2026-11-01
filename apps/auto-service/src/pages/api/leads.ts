export const prerender = false;

import type { APIRoute } from 'astro';
import { waitUntil } from '@vercel/functions';
import { createLeadsRoute } from '@podbor/lead-crm';
import { acceptedSecrets } from '@podbor/lead-crm/verify-secret';
import { LOCALE_COOKIE } from '@podbor/site-kit';
import { phoneLink, whatsappLink } from '@podbor/site-kit/contact-links';
import { formatPhone } from '@podbor/site-kit/format-phone';
import { notifyLead } from '@/lib/crm';
import { reportShopEvent } from '@/lib/shopEvents';
import { PRIMARY_LOCALE, isLocale } from '@/i18n/config';
import { content } from '@/i18n/content';
import { PHONE_NUMBER, SITE_NAME, WHATSAPP_NUMBER } from '@/utils/constants';
import { PathBuilder } from '@/utils/paths';
import { VIN_INQUIRY_SERVICE } from '@/utils/services';

const leadsRoute = createLeadsRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale: PRIMARY_LOCALE,
  localeCookie: LOCALE_COOKIE,
  thanksPath: (locale, service) =>
    service === VIN_INQUIRY_SERVICE
      ? PathBuilder.partsThanks(locale)
      : PathBuilder.thanks(locale),
  refusalCopy: (locale) => {
    const { form, footer } = content(locale).site;
    return {
      brand: {
        name: SITE_NAME,
        home: PathBuilder.home(locale),
        background: '#ffffff',
        text: '#222324',
        accent: '#fa6610',
        onAccent: '#222324',
      },
      reasons: {
        'missing-contact': form.errorTelegram,
        'invalid-phone': form.errorPhone,
        'invalid-telegram': form.errorTelegramHandle,
        'missing-consent': form.errorConsent,
      },
      consent: `${form.privacyNote} ${form.privacyLinkText}.`,
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
  orderCanceled: {
    secret: acceptedSecrets(process.env, 'SHOP_LEAD_SECRET'),
    cancel: async (orderId) =>
      (await import('@/lib/crmBot')).cancelOrderLead(orderId),
  },
});

export const POST: APIRoute = async (context) => {
  const response = await leadsRoute(context);
  if (response.status >= 400) {
    reportShopEvent(context.request, {
      event: 'storefront.lead',
      source: 'leads',
      service: null,
      outcome: 'refused',
      reason:
        response.status === 400 ? 'invalid_form' : `status_${response.status}`,
    });
  }
  return response;
};
