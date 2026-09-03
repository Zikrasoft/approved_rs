export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import { getDuePostponed, resumeLead } from '@/lib/store';
import { sendPostponeReminderToOwner, refreshLeadCard } from '@/lib/telegram';

const CRON_SECRET = import.meta.env.CRON_SECRET;

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

  const due = await getDuePostponed();
  let remindedPostponed = 0;
  for (const lead of due) {
    try {
      await sendPostponeReminderToOwner(lead);
      const resumed = await resumeLead(lead.id);
      if (resumed) await refreshLeadCard(resumed);
      remindedPostponed++;
    } catch (err) {
      console.error('[reminders] failed to send/resume a due postponed lead', { error: err, leadId: lead.id });
    }
  }

  return new Response(JSON.stringify({ remindedPostponed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
