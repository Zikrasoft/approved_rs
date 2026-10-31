import { describe, it, expect } from 'vitest';
import {
  contactChannelSchema,
  isValidContact,
  leadEnvelopeSchema,
  leadSubmissionSchema,
  shownPage,
  siteUrl,
  sourceUrlSchema,
  serviceSlugSchema,
  visitorIdSchema,
  adSourceFieldSchema,
  metaIdsFieldSchema,
  MAX_COMMENT_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_SERVICES,
  PHONE_COUNTRIES,
  phoneCountryOptions,
} from './form.ts';
import { SERVICE_LABELS_RU, SERVICE_SLUGS_BY_BRAND } from '@podbor/brands';
import { TRACKED_CONTACT_CHANNELS } from './contactChannel.ts';

const VISITOR_ID = '9f1c2b7e-4a3d-4c9e-8b21-6f0d5a7c3e11';

function submit(fields: Record<string, string | string[]>) {
  const form = new FormData();
  Object.entries({ consent: 'on', ...fields }).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item));
    else form.append(key, value);
  });
  return leadSubmissionSchema.safeParse(form);
}

const phone = (contact: string, service = '') =>
  submit({ name: 'Иван', contact, service });

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
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
    PHONE_COUNTRIES.forEach((country) => {
      expect(Object.keys(country).sort()).toEqual(['dial', 'iso', 'primary']);
      expect(country.dial).toMatch(/^\d+$/);
    });
  });

  it('covers a country the old curated list left out', () => {
    expect(PHONE_COUNTRIES.find((c) => c.iso === 'KG')?.dial).toBe('996');
  });
});

describe('phoneCountryOptions', () => {
  it('labels every country in the requested language and sorts by that name', () => {
    const options = phoneCountryOptions('ru');
    const names = options.map((option) => option.name);

    expect(options).toHaveLength(PHONE_COUNTRIES.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ru')));
    expect(options.find((option) => option.iso === 'RS')?.name).toBe('Сербия');
  });

  it('follows the locale, so the same country reads natively', () => {
    expect(phoneCountryOptions('sr').find((o) => o.iso === 'RS')?.name).toBe(
      'Србија',
    );
  });

  it('derives the flag from the iso code', () => {
    expect(phoneCountryOptions('en').find((o) => o.iso === 'RS')?.flag).toBe(
      '🇷🇸',
    );
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

describe('adSourceFieldSchema', () => {
  const AT = '2026-10-01T10:00:00.000Z';
  const field = (value: unknown) => JSON.stringify(value);

  it('reads the ad visit the site posted', () => {
    expect(
      adSourceFieldSchema.parse(
        field({
          source: 'instagram',
          campaign: 'Spring | RS (v2)',
          content: 'reel-1',
          at: AT,
        }),
      ),
    ).toEqual({
      source: 'instagram',
      campaign: 'Spring | RS (v2)',
      content: 'reel-1',
      at: AT,
    });
  });

  it('cleans a campaign or content instead of dropping it', () => {
    expect(
      adSourceFieldSchema.parse(
        field({
          source: 'facebook',
          campaign: '<b>x</b>',
          content: 'x'.repeat(101),
          at: AT,
        }),
      ),
    ).toEqual({
      source: 'facebook',
      campaign: 'bx/b',
      content: 'x'.repeat(100),
      at: AT,
    });
  });

  it('strips what it cannot keep instead of dropping the visit', () => {
    expect(
      adSourceFieldSchema.parse(
        field({ source: ' facebook<script>\n', campaign: 42, at: AT }),
      ),
    ).toEqual({ source: 'facebookscript', at: AT });
  });

  it('keeps a visit only its medium identifies', () => {
    expect(adSourceFieldSchema.parse(field({ medium: 'cpc', at: AT }))).toEqual(
      { medium: 'cpc', at: AT },
    );
  });

  it.each([
    null,
    '',
    'not json',
    field(null),
    field({ source: '', at: AT }),
    field({ source: '<>', campaign: ' ', at: AT }),
    field({ at: AT }),
    field({ source: 'facebook', at: 'yesterday' }),
  ])('drops %p rather than failing the whole submission', (value) => {
    expect(adSourceFieldSchema.parse(value)).toBeNull();
  });
});

describe('metaIdsFieldSchema', () => {
  const field = (value: unknown) => JSON.stringify(value);

  it('reads the Meta cookies the site posted', () => {
    expect(
      metaIdsFieldSchema.parse(
        field({
          fbc: 'fb.1.1760000000000.IwAR2F4-dbP0l7Mn',
          fbp: 'fb.1.1596403881668.1116446470',
        }),
      ),
    ).toEqual({
      fbc: 'fb.1.1760000000000.IwAR2F4-dbP0l7Mn',
      fbp: 'fb.1.1596403881668.1116446470',
    });
  });

  it('keeps one id when the other is malformed', () => {
    expect(
      metaIdsFieldSchema.parse(
        field({ fbc: 'IwAR2F4', fbp: 'fb.1.1596403881668.1116446470' }),
      ),
    ).toEqual({ fbp: 'fb.1.1596403881668.1116446470' });
  });

  it.each([
    null,
    '',
    'not json',
    field({}),
    field({ fbc: 'fb.1.x.y', fbp: '<script>' }),
    field({ fbp: `fb.1.1596403881668.${'1'.repeat(501)}` }),
  ])('drops %p rather than failing the whole submission', (value) => {
    expect(metaIdsFieldSchema.parse(value)).toBeNull();
  });
});

describe('sourceUrlSchema', () => {
  it.each([
    `https://carlab.rs/ru/${'a'.repeat(9000)}`,
    'javascript:alert(1)',
    'data:text/html,<b>x</b>',
    '/ru/parts/',
  ])('drops %s, which is no page a visitor stood on', (value) => {
    expect(sourceUrlSchema.parse(value)).toBeNull();
  });

  it('keeps an http(s) page', () => {
    expect(sourceUrlSchema.parse(' https://carlab.rs/ru/parts/ ')).toBe(
      'https://carlab.rs/ru/parts/',
    );
  });

  it.each([null, undefined, '', '   '])('turns %p into null', (value) => {
    expect(sourceUrlSchema.parse(value)).toBeNull();
  });

  it('falls back to null for a value that is not text', () => {
    expect(sourceUrlSchema.parse(new File([], 'x.txt'))).toBeNull();
  });
});

describe('siteUrl', () => {
  it('keeps a page of the site that took the Lead', () => {
    expect(siteUrl('https://carlab.rs/ru/', 'https://carlab.rs')).toBe(
      'https://carlab.rs/ru/',
    );
  });

  it.each([
    'https://evil.example/ru/',
    'http://carlab.rs/ru/',
    'javascript:alert(1)',
  ])('drops %s', (value) => {
    expect(siteUrl(value, 'https://carlab.rs')).toBeNull();
  });
});

describe('shownPage', () => {
  it.each([
    ['https://carlab.rs/ru/', 'https://carlab.rs/ru/'],
    ['/ru/parts/', '/ru/parts/'],
    ['javascript:alert(1)', null],
  ])('shows %s as %s', (stored, shown) => {
    expect(shownPage(stored)).toBe(shown);
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

  it('rejects a handle too short to be one', () => {
    expect(isValidContact('ab', 'telegram')).toBe(false);
  });

  it('accepts a number typed into the telegram field', () => {
    expect(isValidContact('+381641234567', 'telegram')).toBe(true);
  });

  it('rejects a number dressed up as a handle', () => {
    expect(isValidContact('@0641234567', 'telegram')).toBe(false);
    expect(isValidContact('0641234567', 'telegram')).toBe(false);
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
  it('accepts a lead with no name, since only the contact is asked for', () => {
    const parsed = submit({ name: '  ', contact: '+381641234567' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe('');
  });

  it('keeps every line of the comment on a plain line break', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      vin: 'WBA35BG070N074158',
      comment: 'BMW 320d\r\nMann HU 816 x\rNote',
    });
    expect(parsed.success && parsed.data.comment).toBe(
      'VIN: WBA35BG070N074158\nBMW 320d\nMann HU 816 x\nNote',
    );
  });

  it('writes a VIN typed in lower case as the upper-case VIN it is', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      vin: 'wba35bg070n074158',
    });
    expect(parsed.success && parsed.data.comment).toBe(
      'VIN: WBA35BG070N074158',
    );
  });

  it('writes a VIN typed with Cyrillic look-alikes in Latin letters', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      vin: 'WВА 35ВG070N074158',
    });
    expect(parsed.success && parsed.data.comment).toBe(
      'VIN: WBA35BG070N074158',
    );
  });

  it('keeps what was typed in the VIN field, but never passes it off as a VIN', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      vin: 'жжж123',
    });
    expect(parsed.success && parsed.data.comment).toBe(
      'VIN не распознан: ЖЖЖ123',
    );
  });

  it('carries the shop order the Lead was placed for', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      order_id: ' order_01J ',
    });
    expect(parsed.success && parsed.data.orderId).toBe('order_01J');
  });

  it('leaves a form Lead without an order', () => {
    const parsed = submit({ name: '', contact: '+381641234567' });
    expect(parsed.success && parsed.data.orderId).toBeNull();
  });

  it('rejects a missing contact', () => {
    expect(submit({ name: 'Иван' }).success).toBe(false);
  });

  it('rejects a submission that carries no consent', () => {
    expect(
      submit({ name: 'Иван', contact: '+381641234567', consent: '' }),
    ).toMatchObject({ success: false });
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
      service: ['polishing-ceramic', 'paint-protection-film'],
    });
    expect(parsed.data?.service).toBe('polishing-ceramic');
    expect(parsed.data?.services).toEqual([
      'polishing-ceramic',
      'paint-protection-film',
    ]);
  });

  it('drops blank service values instead of storing them', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: ['', 'polishing-ceramic'],
    });
    expect(parsed.data?.service).toBe('polishing-ceramic');
    expect(parsed.data?.services).toEqual(['polishing-ceramic']);
  });

  it.each(Object.entries(SERVICE_SLUGS_BY_BRAND))(
    'accepts every %s slug the brand site posts',
    (_brand, slugs) => {
      slugs.forEach((slug) => {
        const parsed = phone('+381641234567', slug);
        expect(parsed.data?.service).toBe(slug);
      });
    },
  );

  it('accepts every labelled slug a page may post beside the brand lists', () => {
    Object.keys(SERVICE_LABELS_RU).forEach((slug) => {
      expect(serviceSlugSchema.safeParse(slug).success).toBe(true);
    });
  });

  it.each(Object.keys(SERVICE_SLUGS_BY_BRAND))(
    'keeps the lead but drops a service outside the enum on a %s form',
    (brand) => {
      const parsed = phone('+381641234567', `${brand}-no-such-service`);
      expect(parsed.success && parsed.data.services).toEqual([]);
    },
  );

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

  it('discards the visible phone field the script composes contact from', () => {
    const parsed = submit({
      name: '',
      contact: '+381641234567',
      contact_channel: 'whatsapp',
      phone_number: '064 123 4567',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('phone_number');
    expect(parsed.data?.contact).toBe('+381641234567');
  });

  it(`caps the service list at ${MAX_SERVICES} instead of storing what was posted`, () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: Array.from({ length: 10_000 }, () => 'vehicle-sourcing'),
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.services.length).toBeLessThanOrEqual(MAX_SERVICES);
    expect(parsed.data?.service).toBe('vehicle-sourcing');
  });

  it('stores a service posted twice once', () => {
    const parsed = submit({
      name: 'Иван',
      contact: '+381641234567',
      service: Array.from({ length: 20 }, () => 'vehicle-sourcing'),
    });
    expect(parsed.data?.services).toEqual(['vehicle-sourcing']);
  });

  it('keeps the lead but drops a service that is not text at all', () => {
    const parsed = leadSubmissionSchema.safeParse({
      name: 'Иван',
      contact: '+381641234567',
      consent: 'on',
      service: [{ nope: true }],
    });
    expect(parsed.success && parsed.data.services).toEqual([]);
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
      consent: 'on',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.services).toEqual([]);
  });
});

describe('leadSubmissionSchema text hygiene', () => {
  const parsed = (fields: Record<string, string>) => {
    const result = submit(fields);
    if (!result.success) throw result.error;
    return result.data;
  };

  it('keeps the name on one line, without bidi or other control characters', () => {
    expect(
      parsed({
        name: '<b>Ivan</b>\nЗаказ #999\tоплачен \u202eevil\u0000',
        contact: '+381601234567',
      }).name,
    ).toBe('<b>Ivan</b> Заказ #999 оплачен evil');
  });

  it('keeps the joiners an emoji or a script needs', () => {
    expect(
      parsed({ name: 'Ана 👨\u200d👩\u200d👧', contact: '+381601234567' }).name,
    ).toBe('Ана 👨\u200d👩\u200d👧');
  });

  it('stores a valid phone in E.164 whatever digits and spaces it was typed with', () => {
    expect(parsed({ contact: '+381 60 123 4567\u202e' }).contact).toBe(
      '+381601234567',
    );
    expect(parsed({ contact: '+٣٨١٦٠١٢٣٤٥٦٧' }).contact).toBe('+381601234567');
  });

  it('keeps a Telegram handle as typed', () => {
    expect(
      parsed({ contact: '@ivan_p', contact_channel: 'telegram' }).contact,
    ).toBe('@ivan_p');
  });

  it('keeps the comment lines but drops bidi controls', () => {
    expect(
      parsed({ contact: '+381601234567', comment: 'a\u202e\nb\u0007' }).comment,
    ).toBe('a\nb');
  });

  it('composes the contact from the phone a form without JavaScript posts', () => {
    expect(
      parsed({ phone_number: '060 123 4567', phone_country: 'RS' }).contact,
    ).toBe('+381601234567');
  });

  it('reads a number typed internationally without a known country', () => {
    expect(
      parsed({ phone_number: '+381 60 123 4567', phone_country: 'XX' }).contact,
    ).toBe('+381601234567');
  });

  it('composes the contact from the Telegram field on the Telegram channel', () => {
    expect(
      parsed({
        contact_channel: 'telegram',
        telegram: 't.me/ivan_p',
        phone_number: '060 123 4567',
        phone_country: 'RS',
      }).contact,
    ).toBe('@ivan_p');
  });

  it('falls back to the Telegram field when no phone was typed', () => {
    expect(
      parsed({ contact_channel: 'telegram', telegram: '@ivan_p' }).contact,
    ).toBe('@ivan_p');
  });

  it('prefers the contact a script already composed', () => {
    expect(
      parsed({ contact: '+381611111111', phone_number: '060 123 4567' })
        .contact,
    ).toBe('+381611111111');
  });

  it('still asks for a contact when nothing was typed', () => {
    expect(submit({ phone_number: '', telegram: '' }).success).toBe(false);
  });

  it('refuses a body that is not a form', () => {
    expect(leadSubmissionSchema.safeParse('contact=1').success).toBe(false);
  });
});
