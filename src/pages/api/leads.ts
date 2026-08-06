export const prerender = false;

import type { APIContext } from 'astro';
import { sendLeadNotification } from '@/lib/telegram';
import { isLocale, type Locale } from '@/i18n/config';

// Only reached if a visitor bypasses the client-side validation (JS
// disabled, direct POST) — but the cookie-based locale is already right
// there for the redirect below, so there's no excuse for an RU-only body.
const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Имя и контакт обязательны',
  en: 'Name and contact are required',
  sr: 'Ime i kontakt su obavezni',
};

export async function POST({ request, redirect, cookies }: APIContext): Promise<Response> {
  const form = await request.formData();

  const name    = form.get('name')?.toString().trim() ?? '';
  const contact = form.get('contact')?.toString().trim() ?? '';
  const service = form.get('service')?.toString().trim() ?? '';
  const comment = form.get('comment')?.toString().trim() || null;
  const country = form.get('country')?.toString() || null;
  const source_url = form.get('source_url')?.toString() || null;

  const cookieLocale = cookies.get('lang')?.value;
  const locale: Locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : 'ru';

  if (!name || !contact) {
    return new Response(MISSING_FIELDS_MESSAGE[locale], { status: 400 });
  }

  try {
    await sendLeadNotification({ id: Date.now(), name, contact, service, comment, country, source_url });
  } catch (err) {
    console.error('[leads] Telegram notification failed:', err);
  }

  return redirect(`/${locale}/thanks/`, 302);
}
