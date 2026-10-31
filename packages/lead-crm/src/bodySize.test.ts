import { describe, expect, it } from 'vitest';
import { bodyTooLarge, MAX_BODY_BYTES } from './bodySize.ts';

const withLength = (length?: string) =>
  new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: length === undefined ? {} : { 'content-length': length },
  });

describe('bodyTooLarge', () => {
  it('refuses a body declared past the cap', () => {
    expect(bodyTooLarge(withLength(String(MAX_BODY_BYTES + 1)))).toBe(true);
  });

  it.each([undefined, String(MAX_BODY_BYTES), 'garbage'])(
    'lets through a declared length of %s',
    (length) => {
      expect(bodyTooLarge(withLength(length))).toBe(false);
    },
  );
});
