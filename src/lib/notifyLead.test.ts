import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./telegram', () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./sheets', () => ({
  sendLeadToSheet: vi.fn().mockResolvedValue(null),
}));

import { notifyLead } from './notifyLead';
import { sendLeadNotification } from './telegram';
import { sendLeadToSheet } from './sheets';
import type { LeadData } from './leadTypes';

const mockLead: LeadData = {
  id: 42,
  name: 'Иван',
  contact: '@ivan',
  service: 'vehicle-sourcing',
  locale: 'ru',
};

describe('notifyLead', () => {
  beforeEach(() => {
    vi.mocked(sendLeadToSheet).mockReset().mockResolvedValue(null);
    vi.mocked(sendLeadNotification).mockReset().mockResolvedValue(undefined);
  });

  it('calls sendLeadToSheet before sendLeadNotification', async () => {
    const order: string[] = [];
    vi.mocked(sendLeadToSheet).mockImplementation(async () => { order.push('sheet'); return null; });
    vi.mocked(sendLeadNotification).mockImplementation(async () => { order.push('telegram'); });

    await notifyLead(mockLead, '[test]');

    expect(order).toEqual(['sheet', 'telegram']);
  });

  it('passes the rowUrl from sendLeadToSheet into sendLeadNotification', async () => {
    vi.mocked(sendLeadToSheet).mockResolvedValue('https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5');

    await notifyLead(mockLead, '[test]');

    expect(sendLeadNotification).toHaveBeenCalledWith(
      mockLead,
      'https://docs.google.com/spreadsheets/d/abc/edit#gid=0&range=A5'
    );
  });

  it('still calls sendLeadNotification (with no link) when sendLeadToSheet throws', async () => {
    vi.mocked(sendLeadToSheet).mockRejectedValueOnce(new Error('Sheets down'));

    await notifyLead(mockLead, '[test]');

    expect(sendLeadNotification).toHaveBeenCalledWith(mockLead, null);
  });

  it('does not throw when sendLeadNotification also fails', async () => {
    vi.mocked(sendLeadToSheet).mockRejectedValueOnce(new Error('Sheets down'));
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));

    await expect(notifyLead(mockLead, '[test]')).resolves.toBeUndefined();
  });
});
