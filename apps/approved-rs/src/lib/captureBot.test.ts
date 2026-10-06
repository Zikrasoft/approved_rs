import { describe, expect, it } from 'vitest';
import {
  captureClient,
  captureClientFor,
  REPLY_RELAY_BRANDS,
  siblingTokens,
} from './captureBot';

describe('siblingTokens', () => {
  it('holds no sibling without its token', () => {
    expect(siblingTokens({})).toEqual(new Map());
    expect(
      siblingTokens({
        TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: '',
        TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: '',
      }),
    ).toEqual(new Map());
  });

  it('keys each sibling token by its brand name', () => {
    expect(
      siblingTokens({
        TELEGRAM_CAPTURE_BOT_TOKEN_CARLAB: 'carlab-token',
        TELEGRAM_CAPTURE_BOT_TOKEN_DETAILS: 'details-token',
      }),
    ).toEqual(
      new Map([
        ['CarLab', 'carlab-token'],
        ['Details', 'details-token'],
      ]),
    );
  });
});

describe('captureClientFor', () => {
  it('relays through approved.rs and nobody else under the test env', () => {
    expect(REPLY_RELAY_BRANDS).toEqual(['Approved.rs']);
    expect(captureClientFor('Approved.rs')).toBe(captureClient);
    expect(captureClientFor('CarLab')).toBeUndefined();
    expect(captureClientFor('Unknown')).toBeUndefined();
  });
});
