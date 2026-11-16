import { randomUUID } from 'node:crypto';
import { crmDatabase } from '../database.ts';
import { leadData, toStoredLead } from '../leadRow.ts';
import { storedLeadSchema, type StoredLead } from '../schema.ts';

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
    }),
  );
}
