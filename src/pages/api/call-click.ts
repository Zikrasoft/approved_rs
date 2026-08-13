export const prerender = false;

import type { APIContext } from 'astro';
import { notifyLead } from '@/lib/notifyLead';

// Fired via navigator.sendBeacon when a visitor taps a tel: call button —
// not a real lead form, so it's routed through the same notification
// pipeline as a real lead, tagged kind: 'call_click' so Sheets shows
// "Звонок" instead of "Заявка". name/contact are left blank — there's no
// form here, so staff fill those in by hand once they've actually spoken
// to the caller.
export async function POST({ request }: APIContext): Promise<Response> {
  const form = await request.formData();
  const source_url = form.get('source_url')?.toString() || null;

  const lead = {
    id: Date.now(),
    name: '',
    contact: '—',
    service: 'Звонок с сайта',
    comment: 'Посетитель нажал кнопку звонка на сайте. Если пропустили — перезвоните.',
    source_url,
    locale: 'ru' as const,
    kind: 'call_click' as const,
  };

  await notifyLead(lead, '[call-click]');

  // sendBeacon ignores the response body/status either way — 204 is just
  // the honest "accepted, nothing to return" code.
  return new Response(null, { status: 204 });
}
