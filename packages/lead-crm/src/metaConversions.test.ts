import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMetaLeadReporter,
  META_GRAPH_VERSION,
  metaLeadEvent,
} from './metaConversions.ts';

const FBC = 'fb.1.1760000000000.IwAR2F4-dbP0l7Mn';
const FBP = 'fb.1.1596403881668.1116446470';
const SENT_AT = '2026-10-12T09:30:00.000Z';
const PIXEL = '29229430643330595';

const lead = {
  id: 42,
  metaIds: { fbc: FBC, fbp: FBP },
  metaLeadSentAt: SENT_AT,
};

let fetchMock: ReturnType<typeof vi.fn>;
let pending: Promise<unknown>[];
const waitUntil = (promise: Promise<unknown>) => {
  pending.push(promise);
};

beforeEach(() => {
  pending = [];
  fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function reporter(env: Record<string, unknown> = { META_CAPI_TOKEN: 'tok' }) {
  return createMetaLeadReporter({ pixelId: PIXEL, env, waitUntil });
}

describe('metaLeadEvent', () => {
  it('is a chat Lead carrying only the Meta ids', () => {
    expect(metaLeadEvent(lead)).toEqual({
      data: [
        {
          event_name: 'Lead',
          event_time: Date.parse(SENT_AT) / 1000,
          event_id: 'lead-42',
          action_source: 'chat',
          user_data: { fbc: FBC, fbp: FBP },
        },
      ],
    });
  });

  it('leaves out an id the Lead does not have, and adds the test code', () => {
    const event = metaLeadEvent({ ...lead, metaIds: { fbp: FBP } }, 'TEST123');
    expect(event.data[0]!.user_data).toEqual({ fbp: FBP });
    expect(event.test_event_code).toBe('TEST123');
    expect(
      metaLeadEvent({ ...lead, metaIds: { fbc: FBC } }).data[0]!.user_data,
    ).toEqual({ fbc: FBC });
  });
});

describe('createMetaLeadReporter', () => {
  it('is off without a token or a pixel', () => {
    expect(reporter({})).toBeUndefined();
    expect(reporter({ META_CAPI_TOKEN: ' ' })).toBeUndefined();
    expect(
      createMetaLeadReporter({
        pixelId: undefined,
        env: { META_CAPI_TOKEN: 'tok' },
        waitUntil,
      }),
    ).toBeUndefined();
    expect(console.info).toHaveBeenCalledTimes(3);
  });

  it('posts the event to the pixel through waitUntil', async () => {
    reporter({ META_CAPI_TOKEN: 'tok', META_CAPI_TEST_CODE: 'TEST123' })!(lead);
    await Promise.all(pending);
    expect(pending).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${PIXEL}/events`,
    );
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = init.body as URLSearchParams;
    expect(body.get('access_token')).toBe('tok');
    expect(body.get('test_event_code')).toBe('TEST123');
    expect(JSON.parse(body.get('data')!)).toEqual(metaLeadEvent(lead).data);
  });

  it('sends no contact data', async () => {
    reporter()!({ ...lead, contact: '+381601234567', name: 'Ivan' } as never);
    await Promise.all(pending);
    const body = fetchMock.mock.calls[0]![1].body as URLSearchParams;
    expect(body.toString()).not.toMatch(
      /381601234567|Ivan|em|ph|fn|external_id/,
    );
    expect([...body.keys()]).toEqual(['data', 'access_token']);
    expect(Object.keys(JSON.parse(body.get('data')!)[0].user_data)).toEqual([
      'fbc',
      'fbp',
    ]);
  });

  it('keeps the token out of the URL and the logs', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    reporter({ META_CAPI_TOKEN: 'secret-token' })!(lead);
    await Promise.all(pending);
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain('secret-token');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'secret-token',
    );
  });

  it('logs a refusal', async () => {
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    reporter()!(lead);
    await Promise.all(pending);
    expect(console.error).toHaveBeenCalledWith(
      '[meta-capi] Lead event refused',
      { leadId: 42, status: 400, body: 'bad' },
    );
  });

  it('logs a network failure or a timeout instead of throwing', async () => {
    fetchMock.mockImplementationOnce(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(init.signal.reason),
          );
        }),
    );
    createMetaLeadReporter({
      pixelId: PIXEL,
      env: { META_CAPI_TOKEN: 'tok' },
      waitUntil,
      timeoutMs: 5,
    })!(lead);
    await expect(Promise.all(pending)).resolves.toBeDefined();
    expect(console.error).toHaveBeenCalledWith(
      '[meta-capi] could not send the Lead event',
      { leadId: 42, error: expect.anything() },
    );
  });
});
