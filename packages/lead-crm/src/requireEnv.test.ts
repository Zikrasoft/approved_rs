import { describe, it, expect, afterEach } from 'vitest';
import { requireEnv } from './requireEnv.ts';

const NAME = 'PODBOR_TEST_ENV';

afterEach(() => {
  delete process.env[NAME];
});

describe('requireEnv', () => {
  it('returns the value when the variable is set', () => {
    process.env[NAME] = 'token';

    expect(requireEnv(NAME)).toBe('token');
  });

  it('names the variable when it is missing', () => {
    expect(() => requireEnv(NAME)).toThrow(`[telegram] ${NAME} is not set`);
  });

  it('refuses an empty value rather than handing it on', () => {
    process.env[NAME] = '';

    expect(() => requireEnv(NAME)).toThrow(`[telegram] ${NAME} is not set`);
  });
});
