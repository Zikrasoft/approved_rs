import type { LeadData } from './leadTypes';
import { sendLeadNotification } from './telegram';
import { sendLeadToSheet } from './sheets';

// Sequential, not concurrent: the Telegram message wants to link straight to
// the sheet row Apps Script just wrote, and only sendLeadToSheet's response
// knows that row's URL. Safe to run this way now — the caller dispatches
// this whole function via Vercel's waitUntil() after already responding to
// the visitor, so nobody's waiting on either round-trip anymore.
// Still independent in the way that matters: Sheets failing doesn't stop
// the Telegram message, it just goes out without the row link.
export async function notifyLead(lead: LeadData, logPrefix: string): Promise<void> {
  let rowUrl: string | null = null;
  try {
    rowUrl = await sendLeadToSheet(lead);
  } catch (err) {
    console.error(`${logPrefix} Google Sheets append failed:`, err);
  }

  try {
    await sendLeadNotification(lead, rowUrl);
  } catch (err) {
    console.error(`${logPrefix} Telegram notification failed:`, err);
  }
}
