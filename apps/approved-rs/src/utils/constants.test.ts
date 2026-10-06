import { describe, expect, it } from 'vitest';
import { readPublicEnv } from './constants';

const VALID = {
  SITE: 'https://approved.rs',
  PUBLIC_WHATSAPP_NUMBER: '381677702100',
  PUBLIC_VIBER_NUMBER: '381677702100',
  PUBLIC_THREADS_CHANNEL: 'approved.rs',
};

describe('readPublicEnv', () => {
  it('accepts the documented environment', () => {
    expect(() => readPublicEnv(VALID)).not.toThrow();
  });

  it('names the required variable that is empty or missing', () => {
    expect(() =>
      readPublicEnv({ ...VALID, PUBLIC_WHATSAPP_NUMBER: '' }),
    ).toThrow(/PUBLIC_WHATSAPP_NUMBER/);
    expect(() =>
      readPublicEnv({ ...VALID, PUBLIC_WHATSAPP_NUMBER: undefined }),
    ).toThrow(/PUBLIC_WHATSAPP_NUMBER/);
  });
});
