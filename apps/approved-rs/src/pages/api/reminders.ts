export const prerender = false;

import type { APIContext } from 'astro';
import { logError, requireEnv } from '@podbor/lead-crm';
import { bearerToken, secretMatches } from '@podbor/lead-crm/verify-secret';
import {
  claimDigest,
  findIdleTopics,
  recordDigestMessage,
  expireGhostLeads,
  releaseDigest,
  resumeLead,
  type PostedDigest,
} from '@/lib/store';
import {
  sendDigest,
  sendPostponeReminder,
  afterStatusChange,
  closeLeadTopic,
  settlePendingOrders,
} from '@/lib/telegram';

async function expireGhosts(now: Date): Promise<number> {
  const expired = await expireGhostLeads(now);
  for (const lead of expired) {
    try {
      await afterStatusChange(lead);
    } catch (err) {
      logError('[reminders] failed to refresh an expired ghost card', err, {
        leadId: lead.id,
      });
    }
  }
  return expired.length;
}

async function closeIdle(now: Date): Promise<number> {
  let closed = 0;
  for (const lead of await findIdleTopics(now))
    if (await closeLeadTopic(lead)) closed++;
  return closed;
}

async function postDigest(now: Date): Promise<boolean> {
  const digest = await claimDigest(now);
  if (!digest) return false;
  let posted: PostedDigest | null;
  try {
    posted = await sendDigest(digest);
  } catch (err) {
    logError('[reminders] failed to send the digest', err);
    await releaseDigest(now);
    return false;
  }
  if (posted)
    await recordDigestMessage(now, posted).catch((err: unknown) => {
      logError('[reminders] failed to remember the digest', err);
    });
  for (const lead of digest.due) {
    try {
      const resumed = await resumeLead(lead.id);
      if (!resumed) continue;
      await sendPostponeReminder(resumed);
      await afterStatusChange(resumed);
    } catch (err) {
      logError('[reminders] failed to resume a due postponed lead', err, {
        leadId: lead.id,
      });
    }
  }
  return posted != null;
}

export async function GET({ request }: APIContext): Promise<Response> {
  if (
    !secretMatches(
      bearerToken(request.headers.get('authorization')),
      requireEnv('CRON_SECRET'),
    )
  ) {
    return new Response(null, { status: 401 });
  }

  const now = new Date();
  const expiredGhosts = await expireGhosts(now);
  const closedTopics = await closeIdle(now);
  const digestSent = await postDigest(now);
  await settlePendingOrders().catch((error: unknown) => {
    logError('[reminders] failed to retry shop Order outcomes', error);
  });

  return new Response(
    JSON.stringify({ expiredGhosts, closedTopics, digestSent }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
