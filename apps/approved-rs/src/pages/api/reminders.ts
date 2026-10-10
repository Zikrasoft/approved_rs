export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import {
  claimMonthlySummary,
  expireGhostLeads,
  getDuePostponed,
  releaseMonthlySummary,
  resumeLead,
} from '@/lib/store';
import {
  sendMonthlySummary,
  sendPostponeReminderToOwner,
  afterStatusChange,
} from '@/lib/telegram';

const CRON_SECRET = process.env.CRON_SECRET;

function extractBearer(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

async function postMonthlySummary(now: Date): Promise<boolean> {
  const summary = await claimMonthlySummary(now);
  if (!summary) return false;
  try {
    await sendMonthlySummary(summary);
    return true;
  } catch (err) {
    console.error('[reminders] failed to post the monthly summary', {
      error: err,
      month: summary.month,
    });
    await releaseMonthlySummary(summary.month);
    return false;
  }
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

  const now = new Date();
  const due = await getDuePostponed(now);
  let remindedPostponed = 0;
  for (const lead of due) {
    try {
      await sendPostponeReminderToOwner(lead);
      const resumed = await resumeLead(lead.id);
      if (resumed) await afterStatusChange(resumed);
      remindedPostponed++;
    } catch (err) {
      console.error('[reminders] failed to send/resume a due postponed lead', {
        error: err,
        leadId: lead.id,
      });
    }
  }

  const expired = await expireGhostLeads(now);
  for (const lead of expired) {
    try {
      await afterStatusChange(lead, { notice: false });
    } catch (err) {
      console.error('[reminders] failed to refresh an expired ghost card', {
        error: err,
        leadId: lead.id,
      });
    }
  }

  const monthlySummary = await postMonthlySummary(now);

  return new Response(
    JSON.stringify({
      remindedPostponed,
      expiredGhosts: expired.length,
      monthlySummary,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
