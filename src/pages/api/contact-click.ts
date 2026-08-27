export const prerender = false;

import type { APIContext } from 'astro';
import { waitUntil } from '@vercel/functions';
import { notifyLead } from '@/lib/notifyLead';
import { isTrackedContactChannel, type TrackedContactChannel } from '@/utils/contactChannel';

// Fired via navigator.sendBeacon when a visitor taps a phone/Telegram/
// WhatsApp/Viber contact link — not a real lead form (they just left the
// site to message/call), so it's routed through the same notification
// pipeline as a real lead, tagged kind: 'call_click' so Sheets shows it as
// a click, not a "Заявка". name/contact are left blank — there's no form
// here, so staff fill those in by hand once they've actually connected.
// Record<TrackedContactChannel, ...> — the compiler now enforces this stays
// in sync with the shared channel list, not just this endpoint's own guess.
const CHANNEL_COPY: Record<TrackedContactChannel, { service: string; comment: string }> = {
  phone: {
    service: 'Звонок с сайта',
    comment: 'Посетитель нажал кнопку звонка на сайте. Если пропустили — перезвоните.',
  },
  telegram: {
    service: 'Клик Telegram с сайта',
    comment: 'Посетитель нажал кнопку Telegram на сайте. Если не написал первым — напишите сами.',
  },
  whatsapp: {
    service: 'Клик WhatsApp с сайта',
    comment: 'Посетитель нажал кнопку WhatsApp на сайте. Если не написал первым — напишите сами.',
  },
  viber: {
    service: 'Клик Viber с сайта',
    comment: 'Посетитель нажал кнопку Viber на сайте. Если не написал первым — напишите сами.',
  },
};

export async function POST({ request }: APIContext): Promise<Response> {
  const form = await request.formData();
  const source_url = form.get('source_url')?.toString() || null;
  const visitorId = form.get('visitor_id')?.toString() || null;

  // `channel` comes straight from a public, unauthenticated POST body —
  // isTrackedContactChannel is a real allowlist check, not just a fallback:
  // an object-literal lookup keyed by an unvalidated string (e.g.
  // channel="constructor") resolves inherited Object.prototype members
  // instead of undefined, so a plain `?? CHANNEL_COPY.phone` wouldn't have
  // caught it. The normalized value below also becomes contactChannel, so
  // it can never disagree with leads-webhook.gs's own channel→label mapping
  // downstream.
  const rawChannel = form.get('channel')?.toString();
  const channel: TrackedContactChannel = isTrackedContactChannel(rawChannel) ? rawChannel : 'phone';
  const copy = CHANNEL_COPY[channel];

  const lead = {
    id: Date.now(),
    name: '',
    contact: '—',
    service: copy.service,
    contactChannel: channel,
    comment: copy.comment,
    source_url,
    visitorId,
    locale: 'ru' as const,
    kind: 'call_click' as const,
  };

  waitUntil(notifyLead(lead, '[contact-click]'));

  // sendBeacon ignores the response body/status either way — 204 is just
  // the honest "accepted, nothing to return" code.
  return new Response(null, { status: 204 });
}
