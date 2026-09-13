import type { TrackedContactChannel } from '../contactChannel.ts';
import {
  contactChannelSchema,
  sourceUrlSchema,
  visitorIdSchema,
} from '../form.ts';
import type { NotifyLead } from '../notifyLead.ts';

const clickedChannelSchema = contactChannelSchema.catch('phone');

const CHANNEL_COPY: Record<
  TrackedContactChannel,
  { service: string; comment: string }
> = {
  phone: {
    service: 'Звонок с сайта',
    comment:
      'Посетитель нажал кнопку звонка на сайте. Если пропустили — перезвоните.',
  },
  telegram: {
    service: 'Клик Telegram с сайта',
    comment:
      'Посетитель нажал кнопку Telegram на сайте. Если не написал первым — напишите сами.',
  },
  whatsapp: {
    service: 'Клик WhatsApp с сайта',
    comment:
      'Посетитель нажал кнопку WhatsApp на сайте. Если не написал первым — напишите сами.',
  },
  viber: {
    service: 'Клик Viber с сайта',
    comment:
      'Посетитель нажал кнопку Viber на сайте. Если не написал первым — напишите сами.',
  },
};

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
  try {
    const first = new URL(url).pathname.split('/').filter(Boolean)[0];
    return first && isLocale(first) ? first : null;
  } catch {
    return null;
  }
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
    const form = await request.formData();
    const channel = clickedChannelSchema.parse(form.get('channel'));
    const copy = CHANNEL_COPY[channel];
    const sourceUrl = sourceUrlSchema.parse(form.get('source_url'));

    waitUntil(
      notifyLead(
        {
          name: '',
          contact: '—',
          service: copy.service,
          services: [copy.service],
          contactChannel: channel,
          comment: copy.comment,
          source_url: sourceUrl,
          visitorId: visitorIdSchema.parse(form.get('visitor_id')),
          locale: localeFromUrl(sourceUrl, isLocale) ?? defaultLocale,
          kind: 'call_click',
        },
        '[contact-click]',
      ),
    );

    return new Response(null, { status: 204 });
  };
}
