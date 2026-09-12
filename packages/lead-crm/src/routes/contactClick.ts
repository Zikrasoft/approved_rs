import {
  isTrackedContactChannel,
  type TrackedContactChannel,
} from '../contactChannel.ts';
import type { NotifyLead } from '../notifyLead.ts';
import { MAX_URL_LENGTH, visitorId } from './leads.ts';

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
    const field = (key: string, max: number) =>
      form.get(key)?.toString().trim().slice(0, max) || null;
    const rawChannel = form.get('channel')?.toString();
    const channel: TrackedContactChannel = isTrackedContactChannel(rawChannel)
      ? rawChannel
      : 'phone';
    const copy = CHANNEL_COPY[channel];
    const sourceUrl = field('source_url', MAX_URL_LENGTH);

    waitUntil(
      notifyLead(
        {
          name: '',
          contact: '—',
          service: copy.service,
          contactChannel: channel,
          comment: copy.comment,
          source_url: sourceUrl,
          visitorId: visitorId(form.get('visitor_id')?.toString().trim() ?? ''),
          locale: localeFromUrl(sourceUrl, isLocale) ?? defaultLocale,
          kind: 'call_click',
        },
        '[contact-click]',
      ),
    );

    return new Response(null, { status: 204 });
  };
}
