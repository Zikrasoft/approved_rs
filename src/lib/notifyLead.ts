import type { LeadData } from './leadTypes';
import { sendLeadNotification } from './telegram';
import { insertLead, setTelegramMessage, newStoredLead, type StoredLead } from './store';

export async function notifyLead(
  data: Omit<LeadData, 'id'>,
  logPrefix: string,
): Promise<void> {
  console.log(`${logPrefix} notifyLead started`, {
    lead: data,
  });

  let lead: StoredLead;
  try {
    lead = await insertLead(data);
  } catch (err) {
    // Blob write failed — degrade instead of losing the lead: still notify
    // Telegram with a synthetic id, just without CRM status tracking for
    // this one (the webhook won't find a store row for its buttons to act
    // on, but staff at least see the lead).
    console.error(`${logPrefix} store insertLead failed, notifying without CRM tracking`, { error: err, lead: data });
    lead = newStoredLead(data, Date.now());
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
