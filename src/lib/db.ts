import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.DATABASE_URL!);

export interface Lead {
  id: number;
  name: string;
  contact: string;
  service: string;
  comment: string | null;
  country: string | null;
  city: string | null;
  source_url: string | null;
  status: 'new' | 'in_progress' | 'closed' | 'spam';
  tg_message_id: number | null;
  handled_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InsertLeadData {
  name: string;
  contact: string;
  service: string;
  comment?: string | null;
  country?: string | null;
  city?: string | null;
  source_url?: string | null;
}

export async function insertLead(data: InsertLeadData): Promise<Lead> {
  const rows = await sql`
    INSERT INTO leads (name, contact, service, comment, country, city, source_url)
    VALUES (
      ${data.name},
      ${data.contact},
      ${data.service},
      ${data.comment ?? null},
      ${data.country ?? null},
      ${data.city ?? null},
      ${data.source_url ?? null}
    )
    RETURNING *
  `;
  return rows[0] as Lead;
}

export async function updateLeadStatus(
  id: number,
  status: Lead['status'],
  handledBy?: string
): Promise<void> {
  await sql`
    UPDATE leads
    SET status = ${status},
        handled_by = COALESCE(${handledBy ?? null}, handled_by),
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateLeadTgMessageId(
  id: number,
  messageId: number
): Promise<void> {
  await sql`
    UPDATE leads
    SET tg_message_id = ${messageId},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}
