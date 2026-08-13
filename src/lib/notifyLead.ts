import type { LeadData } from './leadTypes';
import { sendLeadNotification } from './telegram';
import { sendLeadToSheet } from './sheets';

// Telegram and Sheets are independent — one failing must never block the
// other, so both dispatch concurrently instead of one after another (was
// sequential, adding the sum of both round-trips to the visitor's wait
// before the redirect/204 instead of just the slower one).
export async function notifyLead(lead: LeadData, logPrefix: string): Promise<void> {
  const [notifyResult, sheetResult] = await Promise.allSettled([
    sendLeadNotification(lead),
    sendLeadToSheet(lead),
  ]);
  if (notifyResult.status === 'rejected') {
    console.error(`${logPrefix} Telegram notification failed:`, notifyResult.reason);
  }
  if (sheetResult.status === 'rejected') {
    console.error(`${logPrefix} Google Sheets append failed:`, sheetResult.reason);
  }
}
