import { describe, expect, it } from 'vitest';
import { APPROVED, DETAILS } from '@podbor/brands';
import { captureClient, captureClientFor, siblingTokens } from './captureBot';

describe('siblingTokens', () => {
  it('holds no sibling without its token', () => {
    expect(siblingTokens({})).toEqual(new Map());
    expect(
      siblingTokens({
        TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED: '',
        TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: '',
      }),
    ).toEqual(new Map());
  });

  it('keys each sibling token by its brand', () => {
    expect([
      ...siblingTokens({
        TELEGRAM_CAPTURE_BOT_TOKEN_APPROVED: 'approved-token',
        TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: 'details-token',
      }),
    ]).toEqual([
      [APPROVED, 'approved-token'],
      [DETAILS, 'details-token'],
    ]);
  });
});

describe('captureClientFor', () => {
  it('relays through carlab.rs and nobody else under the test env', () => {
    expect(captureClientFor('CarLab')).toBe(captureClient);
    expect(captureClientFor('Approved.rs')).toBeUndefined();
    expect(captureClientFor('Unknown')).toBeUndefined();
  });
});
