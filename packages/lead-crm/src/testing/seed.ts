import { randomUUID } from 'node:crypto';
import { crmDatabase } from '../database.ts';
import { leadData, toStoredLead, WITH_NOTES } from '../leadRow.ts';
import {
  leadIdSchema,
  storedLeadSchema,
  type LeadId,
  type StoredLead,
} from '../schema.ts';

export const testLeadId = (n: number): LeadId =>
  leadIdSchema.parse(`0196f8a0-0000-7000-8000-${String(n).padStart(12, '0')}`);

export async function seedLead(
  fields: Partial<StoredLead> = {},
): Promise<StoredLead> {
  const now = new Date().toISOString();
  const lead = storedLeadSchema.parse({
    id: randomUUID(),
    brand: 'Test',
    name: '',
    contact: '—',
    service: '',
    locale: 'ru',
    statusChangedAt: now,
    createdAt: now,
    ...fields,
  });
  return toStoredLead(
    await crmDatabase().lead.create({
      data: leadData({ ...lead, id: fields.id }),
      include: WITH_NOTES,
    }),
  );
}
