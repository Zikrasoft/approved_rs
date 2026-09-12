import type { LeadSubmission, StoredLead } from './schema.ts';
import type { LeadStore } from './store.ts';
import type { Notifier } from './telegram/notify.ts';

interface EnsureLeadCardOptions {
  store: Pick<LeadStore, 'setTelegramMessage'>;
  notifier: Pick<Notifier, 'sendLeadNotification' | 'refreshLeadCard'>;
}

export function createEnsureLeadCard({
  store,
  notifier,
}: EnsureLeadCardOptions) {
  return async function ensureLeadCard(lead: StoredLead): Promise<void> {
    if (await notifier.refreshLeadCard(lead)) return;
    // Deleting the group card is how an archived lead gets retired, so
    // posting it again would undo the gesture that removed it.
    if (lead.archived) return;
    const { chatId, messageId } = await notifier.sendLeadNotification(lead);
    // The card is already in the group; losing its id here only costs the
    // next refresh, so it must not take the caller's whole callback down.
    try {
      const saved = await store.setTelegramMessage(lead.id, chatId, messageId);
      if (!saved)
        console.error('[lead-crm] no lead row to attach the group card to', {
          leadId: lead.id,
          messageId,
        });
    } catch (err) {
      console.error('[lead-crm] failed to persist the group card id', {
        error: err,
        leadId: lead.id,
        messageId,
      });
    }
  };
}

export interface NotifyLeadOptions {
  store: Pick<
    LeadStore,
    'insertOrMergeLead' | 'setTelegramMessage' | 'newStoredLead'
  >;
  notifier: Pick<Notifier, 'sendLeadNotification' | 'refreshLeadCard'>;
  brand: string;
}

export type NotifyLead = (
  data: LeadSubmission,
  logPrefix: string,
) => Promise<void>;

export function createNotifyLead({
  store,
  notifier,
  brand,
}: NotifyLeadOptions): NotifyLead {
  return async function notifyLead(submission, logPrefix) {
    const data = { ...submission, brand };
    console.log(`${logPrefix} notifyLead started`, { lead: data });

    let lead: StoredLead;
    let merged = false;
    try {
      ({ lead, merged } = await store.insertOrMergeLead(data));
    } catch (err) {
      console.error(
        `${logPrefix} store insertLead failed, notifying without CRM tracking`,
        { error: err, lead: data },
      );
      try {
        lead = store.newStoredLead(data, Date.now());
      } catch (fallbackErr) {
        console.error(`${logPrefix} lead failed validation, cannot notify`, {
          error: fallbackErr,
          lead: data,
        });
        return;
      }
    }

    // A repeat submission only ever edits the card it already has. Posting a
    // replacement here would let anyone mint group messages by resubmitting
    // under one visitor id; the operator paths heal a missing card instead.
    if (merged) {
      console.log(`${logPrefix} merged into an existing open lead`, {
        leadId: lead.id,
      });
      try {
        await notifier.refreshLeadCard(lead);
      } catch (err) {
        console.error(`${logPrefix} failed to refresh the merged lead's card`, {
          error: err,
          leadId: lead.id,
        });
      }
      console.log(`${logPrefix} notifyLead finished`);
      return;
    }

    try {
      const { chatId, messageId } = await notifier.sendLeadNotification(lead);
      console.log(`${logPrefix} Telegram notification succeeded`);
      try {
        await store.setTelegramMessage(lead.id, chatId, messageId);
      } catch (err) {
        console.error(`${logPrefix} failed to persist telegram message id`, {
          error: err,
          leadId: lead.id,
        });
      }
    } catch (err) {
      console.error(`${logPrefix} Telegram notification failed`, {
        error: err,
        lead,
      });
    }

    console.log(`${logPrefix} notifyLead finished`);
  };
}
