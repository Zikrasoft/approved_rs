import {
  AD_SOURCE_FIELD,
  adSourceFieldSchema,
  contactChannelSchema,
  META_IDS_FIELD,
  metaIdsFieldSchema,
  siteUrl,
  visitorIdSchema,
} from '../form.ts';
import type { NotifyLead } from '../notifyLead.ts';

const clickedChannelSchema = contactChannelSchema.catch('phone');

export interface ContactClickRouteOptions {
  notifyLead: NotifyLead;
  waitUntil: (promise: Promise<unknown>) => void;
  isLocale: (value: string) => boolean;
  defaultLocale: string;
}

export function localeFromUrl(
  url: string | null,
  isLocale: (value: string) => boolean,
): string | null {
  if (!url) return null;
  const first = new URL(url).pathname.split('/').filter(Boolean)[0];
  return first && isLocale(first) ? first : null;
}

export function createContactClickRoute({
  notifyLead,
  waitUntil,
  isLocale,
  defaultLocale,
}: ContactClickRouteOptions) {
  return async function POST({
    request,
  }: {
    request: Request;
  }): Promise<Response> {
    const form = await request.formData().catch(() => null);
    if (!form) {
      return new Response(null, { status: 400 });
    }
    const visitorId = visitorIdSchema.parse(form.get('visitor_id'));
    if (!visitorId) return new Response(null, { status: 204 });
    const channel = clickedChannelSchema.parse(form.get('channel'));
    const sourceUrl = siteUrl(
      form.get('source_url'),
      new URL(request.url).origin,
    );

    waitUntil(
      notifyLead(
        {
          name: '',
          contact: '—',
          service: '',
          services: [],
          contactChannel: channel,
          comment: '',
          source_url: sourceUrl,
          visitorId,
          adSource: adSourceFieldSchema.parse(form.get(AD_SOURCE_FIELD)),
          metaIds: metaIdsFieldSchema.parse(form.get(META_IDS_FIELD)),
          locale: localeFromUrl(sourceUrl, isLocale) ?? defaultLocale,
          kind: 'call_click',
        },
        '[contact-click]',
      ),
    );

    return new Response(null, { status: 204 });
  };
}
