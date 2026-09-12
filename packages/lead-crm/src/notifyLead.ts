import type { LeadSubmission, StoredLead } from './schema.ts';
import type { LeadStore } from './store.ts';
import type { Notifier } from './telegram/notify.ts';

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

    if (merged) {
      console.log(`${logPrefix} merged into an existing open lead`, {
        leadId: lead.id,
      });
      if (lead.telegramChatId != null && lead.telegramMessageId != null) {
        try {
          await notifier.refreshLeadCard(lead);
        } catch (err) {
          console.error(
            `${logPrefix} failed to refresh the merged lead's card`,
            { error: err, leadId: lead.id },
          );
        }
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
