export const prerender = false;

import type { APIContext } from 'astro';
import { secretMatches } from '@/lib/verifySecret';
import {
  claimDigest,
  findIdleTopics,
  recordDigestMessage,
  expireGhostLeads,
  releaseDigest,
  resumeLead,
} from '@/lib/store';
import {
  sendDigest,
  sendPostponeReminder,
  afterStatusChange,
  closeLeadTopic,
} from '@/lib/telegram';

const CRON_SECRET = process.env.CRON_SECRET;

function extractBearer(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

async function expireGhosts(now: Date): Promise<number> {
  const expired = await expireGhostLeads(now);
  for (const lead of expired) {
    try {
      await afterStatusChange(lead);
    } catch (err) {
      console.error('[reminders] failed to refresh an expired ghost card', {
        error: err,
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
  let posted: Awaited<ReturnType<typeof sendDigest>>;
  try {
    posted = await sendDigest(digest);
  } catch (err) {
    console.error('[reminders] failed to send the digest', { error: err });
    await releaseDigest(now);
    return false;
  }
  if (posted)
    await recordDigestMessage(now, posted).catch((err: unknown) => {
      console.error('[reminders] failed to remember the digest', {
        error: err,
      });
    });
  for (const lead of digest.due) {
    try {
      const resumed = await resumeLead(lead.id);
      if (!resumed) continue;
      await sendPostponeReminder(resumed);
      await afterStatusChange(resumed);
    } catch (err) {
      console.error('[reminders] failed to resume a due postponed lead', {
        error: err,
        leadId: lead.id,
      });
    }
  }
  return posted != null;
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
  const expiredGhosts = await expireGhosts(now);
  const closedTopics = await closeIdle(now);
  const digestSent = await postDigest(now);

  return new Response(
    JSON.stringify({ expiredGhosts, closedTopics, digestSent }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
