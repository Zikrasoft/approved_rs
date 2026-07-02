export const prerender = false;

import type { APIContext } from 'astro';
import { insertLead, updateLeadTgMessageId } from '../../lib/db';
import { sendLeadNotification } from '../../lib/telegram';

export async function POST({ request, redirect }: APIContext): Promise<Response> {
  const form = await request.formData();

  const name    = form.get('name')?.toString().trim() ?? '';
  const contact = form.get('contact')?.toString().trim() ?? '';
  const service = form.get('service')?.toString().trim() ?? '';
  const comment = form.get('comment')?.toString().trim() || null;
  const country = form.get('country')?.toString() || null;
  const city    = form.get('city')?.toString() || null;
  const source_url = form.get('source_url')?.toString() || null;

  if (!name || !contact) {
    return new Response('Имя и контакт обязательны', { status: 400 });
  }

  const lead = await insertLead({ name, contact, service, comment, country, city, source_url });

  try {
    const messageId = await sendLeadNotification(lead);
    await updateLeadTgMessageId(lead.id, messageId);
  } catch (err) {
    console.error('[leads] Telegram notification failed:', err);
  }

  return redirect('/thanks/', 302);
}
