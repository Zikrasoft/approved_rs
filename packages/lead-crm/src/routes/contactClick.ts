import {
  isTrackedContactChannel,
  type TrackedContactChannel,
} from '../contactChannel.ts';
import type { NotifyLead } from '../notifyLead.ts';

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
  defaultLocale: string;
}

export function createContactClickRoute({
  notifyLead,
  waitUntil,
  defaultLocale,
}: ContactClickRouteOptions) {
  return async function POST({
    request,
  }: {
    request: Request;
  }): Promise<Response> {
    const form = await request.formData();
    const rawChannel = form.get('channel')?.toString();
    const channel: TrackedContactChannel = isTrackedContactChannel(rawChannel)
      ? rawChannel
      : 'phone';
    const copy = CHANNEL_COPY[channel];

    waitUntil(
      notifyLead(
        {
          name: '',
          contact: '—',
          service: copy.service,
          contactChannel: channel,
          comment: copy.comment,
          source_url: form.get('source_url')?.toString() || null,
          visitorId: form.get('visitor_id')?.toString() || null,
          locale: defaultLocale,
          kind: 'call_click',
        },
        '[contact-click]',
      ),
    );

    return new Response(null, { status: 204 });
  };
}
