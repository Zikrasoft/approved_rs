import type { LeadData } from './leadTypes';
import { sendLeadNotification } from './telegram';

export async function notifyLead(
  lead: LeadData,
  logPrefix: string,
): Promise<void> {
  console.log(`${logPrefix} notifyLead started`, {
    lead,
  });

  try {
    await sendLeadNotification(lead);
    console.log(`${logPrefix} Telegram notification succeeded`);
  } catch (err) {
    console.error(`${logPrefix} Telegram notification failed`, {
      error: err,
      lead,
    });
  }

  console.log(`${logPrefix} notifyLead finished`);
}
