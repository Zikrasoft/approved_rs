export const prerender = false;

import type { APIContext } from 'astro';
import { sendLeadNotification } from '../../lib/telegram';
import { isLocale } from '../../i18n/config';

export async function POST({ request, redirect, cookies }: APIContext): Promise<Response> {
  const form = await request.formData();

  const name    = form.get('name')?.toString().trim() ?? '';
  const contact = form.get('contact')?.toString().trim() ?? '';
  const service = form.get('service')?.toString().trim() ?? '';
  const comment = form.get('comment')?.toString().trim() || null;
  const country = form.get('country')?.toString() || null;
  const source_url = form.get('source_url')?.toString() || null;

  if (!name || !contact) {
    return new Response('Имя и контакт обязательны', { status: 400 });
  }

  try {
    await sendLeadNotification({ id: Date.now(), name, contact, service, comment, country, source_url });
  } catch (err) {
    console.error('[leads] Telegram notification failed:', err);
  }

  const cookieLocale = cookies.get('lang')?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : 'ru';
  return redirect(`/${locale}/thanks/`, 302);
}
