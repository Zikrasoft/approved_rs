import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./telegram', () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));

import { notifyLead } from './notifyLead';
import { sendLeadNotification } from './telegram';
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
    vi.mocked(sendLeadNotification).mockReset().mockResolvedValue(undefined);
  });

  it('calls sendLeadNotification with the lead', async () => {
    await notifyLead(mockLead, '[test]');

    expect(sendLeadNotification).toHaveBeenCalledWith(mockLead);
  });

  it('does not throw when sendLeadNotification fails', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));

    await expect(notifyLead(mockLead, '[test]')).resolves.toBeUndefined();
  });
});
