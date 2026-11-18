import { logError } from '../logError.ts';
import { requireEnv } from '../requireEnv.ts';
import { bearerToken, secretMatches } from '../verifySecret.ts';
import type { LeadStore, PostedDigest } from '../store.ts';
import type { BrandBot } from '../brandBot.ts';

export interface RemindersRouteOptions {
  leadStore: LeadStore;
  bot: BrandBot;
}

export function createRemindersRoute({
  leadStore,
  bot,
}: RemindersRouteOptions) {
  const {
    claimDigest,
    findIdleTopics,
    recordDigestMessage,
    expireGhostLeads,
    releaseDigest,
    resumeLead,
  } = leadStore;
  const { afterStatusChange, closeLeadTopic, settlePendingOrders } = bot;
  const { sendDigest, sendPostponeReminder } = bot.notifier;

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

  async function GET({ request }: { request: Request }): Promise<Response> {
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

  return GET;
}
