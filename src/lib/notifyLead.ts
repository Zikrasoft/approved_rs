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
export async function notifyLead(
  lead: LeadData,
  logPrefix: string,
): Promise<void> {
  console.log(`${logPrefix} notifyLead started`, {
    lead,
  });

  let rowUrl: string | null = null;

  try {
    console.log(`${logPrefix} Sending lead to Google Sheets...`);

    rowUrl = await sendLeadToSheet(lead);

    console.log(`${logPrefix} Google Sheets append succeeded`, {
      rowUrl,
    });
  } catch (err) {
    console.error(`${logPrefix} Google Sheets append failed`, {
      error: err,
      lead,
    });
  }

  try {
    console.log(`${logPrefix} Sending Telegram notification...`, {
      rowUrl,
    });

    await sendLeadNotification(lead, rowUrl);

    console.log(`${logPrefix} Telegram notification succeeded`, {
      rowUrl,
    });
  } catch (err) {
    console.error(`${logPrefix} Telegram notification failed`, {
      error: err,
      rowUrl,
      lead,
    });
  }

  console.log(`${logPrefix} notifyLead finished`, {
    rowUrl,
  });
}
