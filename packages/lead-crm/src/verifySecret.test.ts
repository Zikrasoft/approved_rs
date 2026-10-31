import { describe, it, expect } from 'vitest';
import { bearerToken, secretMatches } from './verifySecret.ts';

describe('bearerToken', () => {
  it.each(['Bearer s3cret', 'bearer s3cret', 'BEARER s3cret'])(
    'takes the token after the Bearer scheme in any case: %s',
    (header) => {
      expect(bearerToken(header)).toBe('s3cret');
    },
  );

  it.each([null, undefined, '', 's3cret', 'Bearers3cret', 'Basic s3cret'])(
    'reads no token from %s',
    (header) => {
      expect(bearerToken(header)).toBe('');
    },
  );
});

describe('secretMatches', () => {
  it('matches when received equals expected', () => {
    expect(secretMatches('correct-secret', 'correct-secret')).toBe(true);
  });

  it('rejects a wrong value of the same length', () => {
    expect(secretMatches('wrong-secretx', 'correct-secret')).toBe(false);
  });

  it('rejects a shorter received value (would throw in timingSafeEqual without the length guard)', () => {
    expect(secretMatches('short', 'correct-secret')).toBe(false);
  });

  it('rejects a longer received value', () => {
    expect(
      secretMatches('correct-secret-and-then-some', 'correct-secret'),
    ).toBe(false);
  });

  it('rejects when received is a prefix of expected', () => {
    expect(secretMatches('correct', 'correct-secret')).toBe(false);
  });

  it('rejects when expected is a prefix of received', () => {
    expect(secretMatches('correct-secret-extra', 'correct')).toBe(false);
  });

  it('rejects null received', () => {
    expect(secretMatches(null, 'correct-secret')).toBe(false);
  });

  it('rejects undefined received', () => {
    expect(secretMatches(undefined, 'correct-secret')).toBe(false);
  });

  it('rejects an empty-string received, even against an empty-string expected', () => {
    expect(secretMatches('', '')).toBe(false);
  });

  it('rejects when expected is undefined (secret not configured server-side)', () => {
    expect(secretMatches('anything', undefined)).toBe(false);
  });

  it('rejects when both are undefined/null', () => {
    expect(secretMatches(null, undefined)).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(secretMatches('Correct-Secret', 'correct-secret')).toBe(false);
  });

  it('is sensitive to surrounding whitespace (no implicit trim)', () => {
    expect(secretMatches(' correct-secret', 'correct-secret')).toBe(false);
    expect(secretMatches('correct-secret ', 'correct-secret')).toBe(false);
  });

  it('accepts the current or the previous secret while one rotates', () => {
    const accepted = ['new-secret', 'old-secret'];

    expect(secretMatches('new-secret', accepted)).toBe(true);
    expect(secretMatches('old-secret', accepted)).toBe(true);
    expect(secretMatches('other-secr', accepted)).toBe(false);
    expect(secretMatches('new-secret', ['new-secret', undefined])).toBe(true);
    expect(secretMatches('anything', [undefined, ''])).toBe(false);
  });
});
