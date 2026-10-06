import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPublicEnvSchema } from './publicEnv.ts';

const schema = createPublicEnvSchema({ siteDefault: 'https://example.rs' });
const VALID = { PUBLIC_PHONE_NUMBER: '381601234567' };

describe('createPublicEnvSchema', () => {
  it('defaults the site and falls the messengers back to the phone', () => {
    expect(schema.parse(VALID)).toEqual({
      SITE: 'https://example.rs',
      PUBLIC_PHONE_NUMBER: '381601234567',
      PUBLIC_WHATSAPP_NUMBER: '381601234567',
      PUBLIC_VIBER_NUMBER: '381601234567',
    });
  });

  it('keeps a messenger number that is set on its own', () => {
    expect(
      schema.parse({
        ...VALID,
        PUBLIC_WHATSAPP_NUMBER: '1',
        SITE: 'https://x',
      }),
    ).toMatchObject({
      SITE: 'https://x',
      PUBLIC_WHATSAPP_NUMBER: '1',
      PUBLIC_VIBER_NUMBER: '381601234567',
    });
  });

  it('names the required variable that is empty or missing', () => {
    expect(() => schema.parse({ PUBLIC_PHONE_NUMBER: '' })).toThrow(
      /PUBLIC_PHONE_NUMBER/,
    );
    expect(() => schema.parse({})).toThrow(/PUBLIC_PHONE_NUMBER/);
  });

  it('carries the extra fields an app adds through the fallback', () => {
    const extended = createPublicEnvSchema({
      siteDefault: 'https://example.rs',
      extra: { PUBLIC_INSTAGRAM: z.string().min(1).default('placeholder') },
    });
    const env = extended.parse(VALID);
    expect(env.PUBLIC_INSTAGRAM).toBe('placeholder');
    expect(env.PUBLIC_VIBER_NUMBER).toBe('381601234567');
  });
});
