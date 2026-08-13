export const prerender = false;

import type { APIContext } from 'astro';
import { sendLeadNotification } from '@/lib/telegram';
import { sendLeadToSheet } from '@/lib/sheets';
import { isLocale, type Locale } from '@/i18n/config';
import { PathBuilder } from '@/utils/paths';

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
  const contactChannel = form.get('contact_channel')?.toString().trim() || null;
  const comment = form.get('comment')?.toString().trim() || null;
  const country = form.get('country')?.toString() || null;
  const source_url = form.get('source_url')?.toString() || null;

  const cookieLocale = cookies.get('lang')?.value;
  const locale: Locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : 'ru';

  if (!name || !contact) {
    return new Response(MISSING_FIELDS_MESSAGE[locale], { status: 400 });
  }

  const lead = { id: Date.now(), name, contact, service, contactChannel, comment, country, source_url, locale };

  try {
    await sendLeadNotification(lead);
  } catch (err) {
    console.error('[leads] Telegram notification failed:', err);
  }

  try {
    await sendLeadToSheet(lead);
  } catch (err) {
    console.error('[leads] Google Sheets append failed:', err);
  }

  return redirect(PathBuilder.thanks(locale), 302);
}
