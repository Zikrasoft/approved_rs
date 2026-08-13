import type { LeadData } from './leadTypes';

const WEBAPP_URL = import.meta.env.GOOGLE_SHEETS_WEBAPP_URL!;
const WEBAPP_SECRET = import.meta.env.GOOGLE_SHEETS_WEBAPP_SECRET!;

export async function sendLeadToSheet(lead: LeadData): Promise<void> {
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
}
