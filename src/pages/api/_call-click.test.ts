import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/telegram', () => ({
  sendLeadNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/sheets', () => ({
  sendLeadToSheet: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './call-click';
import { sendLeadNotification } from '@/lib/telegram';
import { sendLeadToSheet } from '@/lib/sheets';

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  return {
    request: new Request('http://localhost/api/call-click', { method: 'POST', body: formData }),
  } as any;
}

describe('POST /api/call-click', () => {
  beforeEach(() => {
    vi.mocked(sendLeadNotification).mockResolvedValue(undefined);
    vi.mocked(sendLeadToSheet).mockResolvedValue(undefined);
  });

  it('returns 204', async () => {
    const res = await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(res.status).toBe(204);
  });

  it('calls sendLeadToSheet with kind call_click and an empty name', async () => {
    await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(sendLeadToSheet).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'call_click',
      name: '',
    }));
  });

  it('still returns 204 when sendLeadToSheet throws', async () => {
    vi.mocked(sendLeadToSheet).mockRejectedValueOnce(new Error('Sheets down'));
    const res = await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(res.status).toBe(204);
  });

  it('still returns 204 when sendLeadNotification throws', async () => {
    vi.mocked(sendLeadNotification).mockRejectedValueOnce(new Error('TG down'));
    const res = await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(res.status).toBe(204);
  });
});
