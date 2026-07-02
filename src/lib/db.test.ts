import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSqlFn } = vi.hoisted(() => ({
  mockSqlFn: vi.fn(),
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockSqlFn,
}));

import { insertLead, updateLeadStatus, updateLeadTgMessageId } from './db';

const mockLeadRow = {
  id: 1,
  name: 'Иван',
  contact: '@ivan',
  service: 'autopodbor',
  comment: null,
  country: 'de',
  city: null,
  source_url: null,
  status: 'new' as const,
  tg_message_id: null,
  handled_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('insertLead', () => {
  beforeEach(() => {
    mockSqlFn.mockResolvedValue([mockLeadRow]);
  });

  it('calls sql and returns the inserted lead', async () => {
    const lead = await insertLead({
      name: 'Иван',
      contact: '@ivan',
      service: 'autopodbor',
      country: 'de',
    });
    expect(mockSqlFn).toHaveBeenCalled();
    expect(lead.id).toBe(1);
    expect(lead.name).toBe('Иван');
    expect(lead.status).toBe('new');
  });

  it('passes null for optional fields when not provided', async () => {
    await insertLead({ name: 'Иван', contact: '@ivan', service: 'autopodbor' });
    expect(mockSqlFn).toHaveBeenCalled();
  });
});

describe('updateLeadStatus', () => {
  beforeEach(() => {
    mockSqlFn.mockResolvedValue([]);
  });

  it('calls sql to update status', async () => {
    await updateLeadStatus(1, 'in_progress', 'manager1');
    expect(mockSqlFn).toHaveBeenCalled();
  });

  it('works without handledBy', async () => {
    await updateLeadStatus(1, 'closed');
    expect(mockSqlFn).toHaveBeenCalled();
  });
});

describe('updateLeadTgMessageId', () => {
  beforeEach(() => {
    mockSqlFn.mockResolvedValue([]);
  });

  it('calls sql to set tg_message_id', async () => {
    await updateLeadTgMessageId(1, 999);
    expect(mockSqlFn).toHaveBeenCalled();
  });
});
