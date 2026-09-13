import { describe, it, expect } from 'vitest';
import {
  contactChannelSchema,
  isValidContact,
  leadEnvelopeSchema,
  leadSubmissionSchema,
  sourceUrlSchema,
  visitorIdSchema,
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_SERVICES,
  MAX_URL_LENGTH,
  PHONE_COUNTRIES,
} from './form.ts';
import { TRACKED_CONTACT_CHANNELS } from './contactChannel.ts';

const VISITOR_ID = '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11';

function submit(fields: Record<string, string | string[]>) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
    else form.append(key, value);
  });
  return leadSubmissionSchema.safeParse(form);
}

const phone = (contact: string) => submit({ name: 'Иван', contact });

describe('contactChannelSchema', () => {
  it('accepts every tracked channel', () => {
    TRACKED_CONTACT_CHANNELS.forEach((channel) => {
      expect(contactChannelSchema.parse(channel)).toBe(channel);
    });
  });

  it('rejects an untracked channel', () => {
    expect(contactChannelSchema.safeParse('sms').success).toBe(false);
  });
});

describe('PHONE_COUNTRIES', () => {
  it('carries only the iso and dial code the select renders', () => {
    expect(PHONE_COUNTRIES).toHaveLength(13);
    PHONE_COUNTRIES.forEach((country) => {
      expect(Object.keys(country).sort()).toEqual(['dial', 'iso']);
    });
  });
});

describe('visitorIdSchema', () => {
  it('keeps an id this site could have issued', () => {
    expect(visitorIdSchema.parse(VISITOR_ID)).toBe(VISITOR_ID);
  });

  it.each([null, '', 'not-a-uuid', 'x'.repeat(5000)])(
    'drops %p rather than failing the whole submission',
    (value) => {
      expect(visitorIdSchema.parse(value)).toBeNull();
    },
  );
});

describe('sourceUrlSchema', () => {
  it('truncates an oversized url', () => {
    expect(sourceUrlSchema.parse(`/ru/${'a'.repeat(9000)}`)).toHaveLength(
      MAX_URL_LENGTH,
    );
  });

  it.each([null, undefined, '', '   '])('turns %p into null', (value) => {
    expect(sourceUrlSchema.parse(value)).toBeNull();
  });

  it('falls back to null for a value that is not text', () => {
    expect(sourceUrlSchema.parse(new File([], 'x.txt'))).toBeNull();
  });
});

describe('isValidContact', () => {
  it.each(['+381641234567', '+4915112345678', '+34612345678'])(
    'accepts %s as a phone',
    (contact) => {
      expect(isValidContact(contact, 'phone')).toBe(true);
    },
  );

  it('accepts a Serbian mobile the picker turned into E.164', () => {
    expect(isValidContact('+381641234567', 'phone')).toBe(true);
  });

  it('rejects a national number that never got its dial code', () => {
    expect(isValidContact('064 1234567', 'phone')).toBe(false);
  });

  it('accepts a number from a country outside PHONE_COUNTRIES', () => {
    expect(isValidContact('+33612345678', 'phone')).toBe(true);
  });

  it('accepts a German number typed under the German picker', () => {
    expect(isValidContact('+4930123456', 'phone')).toBe(true);
  });

  it('still accepts a German national number typed under the RS picker', () => {
    expect(isValidContact('+3813012345678', 'phone')).toBe(true);
  });

  it('accepts a handle with and without the leading @', () => {
    expect(isValidContact('@ivan', 'telegram')).toBe(true);
    expect(isValidContact('ivan', 'telegram')).toBe(true);
  });

  it('never runs phone rules on the telegram channel', () => {
    expect(isValidContact('+381641234567', 'telegram')).toBe(false);
    expect(isValidContact('ab', 'telegram')).toBe(false);
  });
});

describe('leadEnvelopeSchema', () => {
  it('reads the locale and the honeypot off the form', () => {
    const form = new FormData();
    form.append('locale', ' en ');
    form.append('website', 'http://spam.example');
    expect(leadEnvelopeSchema.parse(form)).toEqual({
      locale: 'en',
      website: 'http://spam.example',
    });
  });

  it('reads a honeypot uploaded as a file as a hit, not as an absent field', () => {
    const form = new FormData();
    form.append('website', new File([], 'x.txt'));
    expect(leadEnvelopeSchema.parse(form).website).toBe('spam');
  });

  it('drops a locale that is not text without losing the honeypot next to it', () => {
    const form = new FormData();
    form.append('locale', new File([], 'x.txt'));
    form.append('website', 'http://spam.example');
    expect(leadEnvelopeSchema.parse(form)).toEqual({
      locale: undefined,
      website: 'http://spam.example',
    });
  });

  it('takes the first value when a field is submitted twice', () => {
    const form = new FormData();
    form.append('locale', 'en');
    form.append('locale', '');
    expect(leadEnvelopeSchema.parse(form).locale).toBe('en');
  });
});

describe('leadSubmissionSchema', () => {
  it('rejects a name that is only whitespace', () => {
    expect(submit({ name: '  ', contact: '+381641234567' }).success).toBe(
      false,
    );
  });

  it('rejects a missing contact', () => {
    expect(submit({ name: 'Иван' }).success).toBe(false);
  });

  it('rejects "asdf" as a phone number', () => {
    expect(phone('asdf').success).toBe(false);
  });

  it.each(['+381641234567', '+4915112345678', '+905321234567'])(
    'accepts %s, a valid number from a listed country',
    (contact) => {
      expect(phone(contact).success).toBe(true);
    },
  );

  it('rejects a national number with no country code', () => {
    expect(phone('0641234567').success).toBe(false);
  });

  it.each(['@ivan', 'ivan'])('accepts %s as a telegram handle', (contact) => {
    const parsed = submit({
      name: 'Иван',
      contact,
      contact_channel: 'telegram',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.contactChannel).toBe('telegram');
  });

  it('rejects a telegram handle shorter than three characters', () => {
    expect(
      submit({ name: 'Иван', contact: '@iv', contact_channel: 'telegram' })
        .success,
    ).toBe(false);
  });

  it('rejects a contact_channel outside the tracked set', () => {
    expect(
      submit({
        name: 'Иван',
        contact: '+381641234567',
        contact_channel: 'sms',
      }).success,
    ).toBe(false);
  });

  it('treats an empty contact_channel as none given and validates a phone', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      contact_channel: '',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.contactChannel).toBeNull();
  });

  it('keeps every service and promotes the first to the primary one', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: ['polishing', 'ceramic-coating', 'ppf'],
    });
    expect(parsed.data?.service).toBe('polishing');
    expect(parsed.data?.services).toEqual([
      'polishing',
      'ceramic-coating',
      'ppf',
    ]);
  });

  it('drops blank service values instead of storing them', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: ['', 'polishing'],
    });
    expect(parsed.data?.service).toBe('polishing');
    expect(parsed.data?.services).toEqual(['polishing']);
  });

  it('truncates the long fields to their own limits', () => {
    const parsed = submit({
      name: 'a'.repeat(5000),
      contact: '+381641234567',
      comment: 'c'.repeat(9000),
      country: 'd'.repeat(5000),
      city: 'e'.repeat(5000),
    });
    expect(parsed.data?.name).toHaveLength(MAX_FIELD_LENGTH);
    expect(parsed.data?.comment).toHaveLength(MAX_COMMENT_LENGTH);
    expect(parsed.data?.country).toHaveLength(MAX_FIELD_LENGTH);
  });

  it('discards the city the form posts instead of carrying it into the lead', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      city: 'Belgrade',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('city');
  });

  it(`caps the service list at ${MAX_SERVICES} instead of storing what was posted`, () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: Array.from({ length: 10_000 }, (_, i) => `service-${i}`),
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.services).toHaveLength(MAX_SERVICES);
    expect(parsed.data?.service).toBe('service-0');
  });

  it('keeps the lead when the service list is not an array of text at all', () => {
    const parsed = leadSubmissionSchema.safeParse({
      name: 'Иван',
      contact: '+381641234567',
      service: [{ nope: true }],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.services).toEqual([]);
  });

  it('keeps the first value when the same field is submitted twice', () => {
    const parsed = submit({
      name: 'Иван',
      contact: ['@ivan', ''],
      contact_channel: 'telegram',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.contact).toBe('@ivan');
  });

  it('accepts a plain record, not only FormData', () => {
    const parsed = leadSubmissionSchema.safeParse({
      name: 'Иван',
      contact: '+381641234567',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.services).toEqual([]);
  });
});
