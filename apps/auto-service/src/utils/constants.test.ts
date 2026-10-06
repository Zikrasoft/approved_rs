import { describe, expect, it } from 'vitest';
import { readPublicEnv } from './constants';

const VALID = {
  SITE: 'https://carlab.rs',
  PUBLIC_PHONE_NUMBER: '381677210533',
};

describe('readPublicEnv', () => {
  it('accepts the documented environment', () => {
    expect(() => readPublicEnv(VALID)).not.toThrow();
  });

  it('names the required variable that is empty or missing', () => {
    expect(() => readPublicEnv({ ...VALID, PUBLIC_PHONE_NUMBER: '' })).toThrow(
      /PUBLIC_PHONE_NUMBER/,
    );
    expect(() =>
      readPublicEnv({ ...VALID, PUBLIC_PHONE_NUMBER: undefined }),
    ).toThrow(/PUBLIC_PHONE_NUMBER/);
  });
});
