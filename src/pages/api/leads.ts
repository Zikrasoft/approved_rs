export const prerender = false;

import type { APIContext } from 'astro';
import { waitUntil } from '@vercel/functions';
import { notifyLead } from '@/lib/notifyLead';
import { isLocale, type Locale } from '@/i18n/config';
import { PathBuilder } from '@/utils/paths';

// Only reached if a visitor bypasses the client-side validation (JS
// disabled, direct POST) — but the cookie-based locale is already right
// there for the redirect below, so there's no excuse for an RU-only body.
const MISSING_FIELDS_MESSAGE: Record<Locale, string> = {
  ru: 'Имя и контакт обязательны',
  en: 'Name and contact are required',
  sr: 'Ime i kontakt su obavezni',
  es: 'El nombre y el contacto son obligatorios',
  de: 'Name und Kontakt sind erforderlich',
};

export async function POST({
  request,
  redirect,
  cookies,
}: APIContext): Promise<Response> {
  const form = await request.formData();

  const name = form.get('name')?.toString().trim() ?? '';
  const contact = form.get('contact')?.toString().trim() ?? '';
  const service = form.get('service')?.toString().trim() ?? '';
  const contactChannel = form.get('contact_channel')?.toString().trim() || null;
  const comment = form.get('comment')?.toString().trim() || null;
  const country = form.get('country')?.toString() || null;
  const source_url = form.get('source_url')?.toString() || null;
  const visitorId = form.get('visitor_id')?.toString() || null;

  const cookieLocale = cookies.get('lang')?.value;
  const locale: Locale =
    cookieLocale && isLocale(cookieLocale) ? cookieLocale : 'ru';

  if (!name || !contact) {
    return new Response(MISSING_FIELDS_MESSAGE[locale], { status: 400 });
  }

  const lead = {
    name,
    contact,
    service,
    contactChannel,
    comment,
    country,
    source_url,
    visitorId,
    locale,
  };

  // Fire-and-forget after the response: the visitor doesn't wait on either
  // Telegram or Sheets, waitUntil keeps the function alive to finish them.
  waitUntil(notifyLead(lead, '[leads]'));

  return redirect(PathBuilder.thanks(locale), 302);
}
