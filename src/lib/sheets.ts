import type { LeadData } from './leadTypes';

const WEBAPP_URL = import.meta.env.GOOGLE_SHEETS_WEBAPP_URL!;
const WEBAPP_SECRET = import.meta.env.GOOGLE_SHEETS_WEBAPP_SECRET!;

// Returns the sheet's deep link to the row just written (for the Telegram
// notification to point at), or null if the Apps Script's response didn't
// include one — the append itself already succeeded by that point, a
// missing/unparseable link is not worth failing the whole call over.
export async function sendLeadToSheet(lead: LeadData): Promise<string | null> {
  const response = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: WEBAPP_SECRET,
      id: lead.id,
      name: lead.name,
      contact: lead.contact,
      contactChannel: lead.contactChannel,
      service: lead.service,
      country: lead.country,
      locale: lead.locale,
      comment: lead.comment,
      source_url: lead.source_url,
      kind: lead.kind,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Sheets webhook failed: ${response.status}`);
  }

  try {
    const body = await response.json() as { rowUrl?: string };
    return body.rowUrl ?? null;
  } catch {
    return null;
  }
}
