export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import { getStaleLeads, markReminded } from '@/lib/store';
import { sendReminderMessage } from '@/lib/telegram';

const CRON_SECRET = import.meta.env.CRON_SECRET;
const OWNER_ID = Number(import.meta.env.TELEGRAM_OWNER_ID);
const ADMIN_ID = Number(import.meta.env.TELEGRAM_ADMIN_ID);
const DEFAULT_STALE_DAYS = 5;

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically once
// that env var is set on the project — same constant-time-compare pattern
// as the Telegram webhook's own secret check, just a different header shape.
function extractBearer(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export async function GET({ request }: APIContext): Promise<Response> {
  if (!secretMatches(extractBearer(request.headers.get('authorization')), CRON_SECRET)) {
    return new Response(null, { status: 401 });
  }

  const days = Number(import.meta.env.LEAD_STALE_DAYS ?? DEFAULT_STALE_DAYS);
  const stale = await getStaleLeads(Number.isFinite(days) && days > 0 ? days : DEFAULT_STALE_DAYS);

  for (const lead of stale) {
    try {
      await sendReminderMessage(lead, OWNER_ID);
      await sendReminderMessage(lead, ADMIN_ID);
      await markReminded(lead.id);
    } catch (err) {
      console.error('[reminders] failed to send/mark reminder', { error: err, leadId: lead.id });
    }
  }

  return new Response(JSON.stringify({ reminded: stale.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
