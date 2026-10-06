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

  it('names the required variable that is empty or missing', () => {
    expect(() => readPublicEnv({ ...VALID, PUBLIC_PHONE_NUMBER: '' })).toThrow(
      /PUBLIC_PHONE_NUMBER/,
    );
    expect(() =>
      readPublicEnv({ ...VALID, PUBLIC_PHONE_NUMBER: undefined }),
    ).toThrow(/PUBLIC_PHONE_NUMBER/);
  });

  it('leaves the Instagram handle undefined until it is set', () => {
    expect(readPublicEnv(VALID).PUBLIC_INSTAGRAM).toBeUndefined();
    expect(
      readPublicEnv({ ...VALID, PUBLIC_INSTAGRAM: 'details.rs' })
        .PUBLIC_INSTAGRAM,
    ).toBe('details.rs');
    expect(() => readPublicEnv({ ...VALID, PUBLIC_INSTAGRAM: '' })).toThrow(
      /PUBLIC_INSTAGRAM/,
    );
  });
});
