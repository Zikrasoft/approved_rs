export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import { expireGhostLeads, getDuePostponed, resumeLead } from '@/lib/store';
import { sendPostponeReminderToOwner, ensureLeadCard } from '@/lib/telegram';

const CRON_SECRET = process.env.CRON_SECRET;

function extractBearer(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export async function GET({ request }: APIContext): Promise<Response> {
  if (
    !secretMatches(
      extractBearer(request.headers.get('authorization')),
      CRON_SECRET,
    )
  ) {
    return new Response(null, { status: 401 });
  }

  const due = await getDuePostponed();
  let remindedPostponed = 0;
  for (const lead of due) {
    try {
      await sendPostponeReminderToOwner(lead);
      const resumed = await resumeLead(lead.id);
      if (resumed) await ensureLeadCard(resumed);
      remindedPostponed++;
    } catch (err) {
      console.error('[reminders] failed to send/resume a due postponed lead', {
        error: err,
        leadId: lead.id,
      });
    }
  }

  const expired = await expireGhostLeads(new Date());
  for (const lead of expired) {
    try {
      await ensureLeadCard(lead);
    } catch (err) {
      console.error('[reminders] failed to refresh an expired ghost card', {
        error: err,
        leadId: lead.id,
      });
    }
  }

  return new Response(
    JSON.stringify({ remindedPostponed, expiredGhosts: expired.length }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
