import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}));
vi.mock('../../lib/notifyLead', () => ({
  notifyLead: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from './call-click';
import { waitUntil } from '@vercel/functions';
import { notifyLead } from '@/lib/notifyLead';

function makeCtx(fields: Record<string, string>) {
  const formData = new FormData();
  Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
  return {
    request: new Request('http://localhost/api/call-click', { method: 'POST', body: formData }),
  } as any;
}

describe('POST /api/call-click', () => {
  beforeEach(() => {
    vi.mocked(notifyLead).mockResolvedValue(undefined);
    vi.mocked(waitUntil).mockReset();
  });

  it('returns 204', async () => {
    const res = await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(res.status).toBe(204);
  });

  it('dispatches notifyLead via waitUntil with kind call_click and an empty name', async () => {
    await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(notifyLead).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'call_click', name: '' }),
      '[call-click]'
    );
  });

  it('returns 204 without waiting for notifyLead to resolve', async () => {
    let resolveNotify!: () => void;
    vi.mocked(notifyLead).mockReturnValue(new Promise(resolve => { resolveNotify = resolve; }));

    const res = await POST(makeCtx({ source_url: '/ru/vehicle-sourcing/de/' }));

    expect(res.status).toBe(204);
    resolveNotify();
  });
});
