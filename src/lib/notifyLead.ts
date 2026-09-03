import type { LeadData } from './leadTypes';
import { sendLeadNotification, refreshLeadCard } from './telegram';
import { insertOrMergeLead, setTelegramMessage, newStoredLead, type StoredLead } from './store';

export async function notifyLead(
  data: Omit<LeadData, 'id'>,
  logPrefix: string,
): Promise<void> {
  console.log(`${logPrefix} notifyLead started`, {
    lead: data,
  });

  let lead: StoredLead;
  let merged = false;
  try {
    ({ lead, merged } = await insertOrMergeLead(data));
  } catch (err) {
    // Blob write failed — degrade instead of losing the lead: still notify
    // Telegram with a synthetic id, just without CRM status tracking for
    // this one (the webhook won't find a store row for its buttons to act
    // on, but staff at least see the lead).
    console.error(`${logPrefix} store insertLead failed, notifying without CRM tracking`, { error: err, lead: data });
    lead = newStoredLead(data, Date.now());
  }

  if (merged) {
    // Same visitor already has an open lead — update its card in place
    // instead of spamming a second Telegram message for the same person.
    console.log(`${logPrefix} merged into an existing open lead`, { leadId: lead.id });
    if (lead.telegramChatId != null && lead.telegramMessageId != null) {
      try {
        await refreshLeadCard(lead);
      } catch (err) {
        console.error(`${logPrefix} failed to refresh the merged lead's card`, { error: err, leadId: lead.id });
      }
    }
    console.log(`${logPrefix} notifyLead finished`);
    return;
  }

  try {
    const { chatId, messageId } = await sendLeadNotification(lead);
    console.log(`${logPrefix} Telegram notification succeeded`);
    try {
      await setTelegramMessage(lead.id, chatId, messageId);
    } catch (err) {
      console.error(`${logPrefix} failed to persist telegram message id`, { error: err, leadId: lead.id });
    }
  } catch (err) {
    console.error(`${logPrefix} Telegram notification failed`, {
      error: err,
      lead,
    });
  }

  console.log(`${logPrefix} notifyLead finished`);
}
