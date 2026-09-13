import { describe, it, expect } from 'vitest';
import {
  Metadata,
  getCountries,
  getCountryCallingCode,
} from 'libphonenumber-js/min';
import {
  composeE164,
  isValidContact,
  DIAL_CODE_OWNER,
  PHONE_COUNTRIES,
} from './phone.ts';

describe('DIAL_CODE_OWNER', () => {
  const sharedDials = [
    ...getCountries()
      .reduce((counts, iso) => {
        const dial = getCountryCallingCode(iso);
        return counts.set(dial, (counts.get(dial) ?? 0) + 1);
      }, new Map<string, number>())
      .entries(),
  ]
    .filter(([, count]) => count > 1)
    .map(([dial]) => dial);

  it('names an owner for every calling code more than one country shares', () => {
    expect(Object.keys(DIAL_CODE_OWNER).sort()).toEqual(sharedDials.sort());
  });

  it('agrees with libphonenumber about who owns each of them', () => {
    const metadata = new Metadata() as unknown as {
      getCountryCodesForCallingCode(dial: string): string[];
    };
    for (const [dial, iso] of Object.entries(DIAL_CODE_OWNER)) {
      expect(metadata.getCountryCodesForCallingCode(dial)[0], dial).toBe(iso);
    }
  });

  it('marks exactly one country primary per calling code', () => {
    const primariesByDial = new Map<string, number>();
    for (const country of PHONE_COUNTRIES) {
      if (country.primary)
        primariesByDial.set(
          country.dial,
          (primariesByDial.get(country.dial) ?? 0) + 1,
        );
    }
    expect([...primariesByDial.values()].every((n) => n === 1)).toBe(true);
    expect(PHONE_COUNTRIES.find((c) => c.dial === '7' && c.primary)?.iso).toBe(
      'RU',
    );
  });
});

describe('composeE164', () => {
  it('produces a number the server accepts when the phone parser never loads', () => {
    const cases: [string, string][] = [
      ['60 123 4567', '381'],
      ['060 123 4567', '381'],
      ['+49 151 2345678', '381'],
      ['0049 151 2345678', '381'],
      ['912 345 678', '34'],
    ];
    cases.forEach(([typed, dial]) => {
      expect(isValidContact(composeE164(typed, dial), 'phone'), typed).toBe(
        true,
      );
    });
  });

  it('keeps the typed country when the number is already international', () => {
    expect(composeE164('+49 151 2345678', '381')).toBe('+491512345678');
    expect(composeE164('0049 151 2345678', '381')).toBe('+491512345678');
  });

  it('drops the national trunk zero before the dial code', () => {
    expect(composeE164('060 123 4567', '381')).toBe('+381601234567');
  });

  it('prefixes the selected dial code for a plain national number', () => {
    expect(composeE164('60 123 4567', '381')).toBe('+381601234567');
  });
});
