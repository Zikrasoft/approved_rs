export const prerender = false;

import type { APIContext } from 'astro';
import { sendLeadNotification } from '@/lib/telegram';

// Fired via navigator.sendBeacon when a visitor taps a tel: call button —
// not a real lead form, so it's routed through the same notification/triage
// pipeline (accept/close/spam buttons in the group) with synthetic
// name/contact rather than a parallel notification path.
export async function POST({ request }: APIContext): Promise<Response> {
  const form = await request.formData();
  const source_url = form.get('source_url')?.toString() || null;

  try {
    await sendLeadNotification({
      id: Date.now(),
      name: 'Клик «Позвонить»',
      contact: '—',
      service: 'Звонок с сайта',
      comment: 'Посетитель нажал кнопку звонка на сайте. Если пропустили — перезвоните.',
      source_url,
    });
  } catch (err) {
    console.error('[call-click] Telegram notification failed:', err);
  }

  // sendBeacon ignores the response body/status either way — 204 is just
  // the honest "accepted, nothing to return" code.
  return new Response(null, { status: 204 });
}
