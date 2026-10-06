import { describe, expect, it } from 'vitest';
import { readPublicEnv } from './constants';

const VALID = {
  SITE: 'https://details.rs',
  PUBLIC_PHONE_NUMBER: '381677210533',
};

describe('readPublicEnv', () => {
  it('accepts the documented environment', () => {
    expect(() => readPublicEnv(VALID)).not.toThrow();
  });
});
