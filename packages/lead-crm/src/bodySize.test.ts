import { describe, expect, it } from 'vitest';
import { MAX_BODY_BYTES, readForm, readJson } from './bodySize.ts';

const post = (
  body: BodyInit | null,
  headers: Record<string, string> = {},
): Request =>
  new Request('http://localhost/api/leads', {
    method: 'POST',
    body,
    headers,
    ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
  } as RequestInit);

const chunked = (...parts: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      for (const part of parts)
        controller.enqueue(new TextEncoder().encode(part));
      controller.close();
    },
  });

const failing = (): ReadableStream<Uint8Array> =>
  new ReadableStream({
    pull(controller) {
      controller.error(new Error('connection reset'));
    },
  });

const status = (read: { response: Response } | { value: unknown }) =>
  'response' in read ? read.response.status : null;

const value = <T>(read: { response: Response } | { value: T }): T => {
  if ('response' in read) throw new Error('expected a value');
  return read.value;
};

describe('readForm', () => {
  it('reads a form under the cap', async () => {
    const form = value(
      await readForm(
        post('name=Ana&contact=%2B381', {
          'content-type': 'application/x-www-form-urlencoded',
        }),
      ),
    );
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get('contact')).toBe('+381');
  });

  it('reads a multipart form, boundary and all', async () => {
    const sent = new FormData();
    sent.set('name', 'Ana');
    const request = new Request('http://localhost/api/leads', {
      method: 'POST',
      body: sent,
    });
    expect(value(await readForm(request))?.get('name')).toBe('Ana');
  });

  it('refuses a body declared past the cap without reading it', async () => {
    const request = post('x', { 'content-length': String(MAX_BODY_BYTES + 1) });
    expect(status(await readForm(request))).toBe(413);
    expect(request.bodyUsed).toBe(false);
  });

  it('refuses a chunked body with no length that grows past the cap', async () => {
    const half = 'a'.repeat(MAX_BODY_BYTES / 2 + 1);
    const request = post(chunked(half, half), {
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(request.headers.get('content-length')).toBeNull();
    expect(status(await readForm(request))).toBe(413);
  });

  it('honours a cap the route passes', async () => {
    expect(status(await readForm(post('a=12345'), 4))).toBe(413);
  });

  it.each([
    [
      'a body that is not a form',
      post('{}', { 'content-type': 'application/json' }),
    ],
    ['a body that breaks off', post(failing())],
    ['a body sent with no content type', post(chunked('a=1'))],
  ])('gives nothing for %s', async (_, request) => {
    expect(await readForm(request)).toEqual({ value: null });
  });

  it('reads an empty form from a request with no body', async () => {
    const request = new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(value(await readForm(request))).toEqual(new FormData());
  });
});

describe('readJson', () => {
  it('reads JSON under the cap, chunked or not', async () => {
    expect(await readJson(post('{"cart_id":"c1"}'))).toEqual({
      value: { cart_id: 'c1' },
    });
    expect(await readJson(post(chunked('{"a":', '1}')))).toEqual({
      value: { a: 1 },
    });
  });

  it('refuses JSON past the cap', async () => {
    expect(
      status(
        await readJson(post(chunked('"', 'a'.repeat(MAX_BODY_BYTES), '"'))),
      ),
    ).toBe(413);
  });

  it.each([
    ['malformed JSON', post('{')],
    ['a body that breaks off', post(failing())],
  ])('gives nothing for %s', async (_, request) => {
    expect(await readJson(request)).toEqual({ value: null });
  });
});
