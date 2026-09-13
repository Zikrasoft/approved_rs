import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';
import type { TrackedContactChannel } from './contactChannel.ts';

export { composeE164 } from './composeE164.ts';

export interface PhoneCountry {
  iso: CountryCode;
  dial: string;
  primary: boolean;
}

export const DIAL_CODE_OWNER: Record<string, CountryCode> = {
  '1': 'US',
  '7': 'RU',
  '39': 'IT',
  '44': 'GB',
  '47': 'NO',
  '61': 'AU',
  '212': 'MA',
  '262': 'RE',
  '290': 'SH',
  '358': 'FI',
  '590': 'GP',
  '599': 'CW',
};

export const PHONE_COUNTRIES: readonly PhoneCountry[] = getCountries().map(
  (iso) => {
    const dial = getCountryCallingCode(iso);
    return { iso, dial, primary: (DIAL_CODE_OWNER[dial] ?? iso) === iso };
  },
);

export interface PhoneCountryOption extends PhoneCountry {
  name: string;
  flag: string;
}

const REGIONAL_INDICATOR_A = 0x1f1e6;

const flagOf = (iso: string) =>
  String.fromCodePoint(
    ...[...iso].map(
      (letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65,
    ),
  );

export function phoneCountryOptions(locale: string): PhoneCountryOption[] {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  return PHONE_COUNTRIES.map((country) => ({
    ...country,
    flag: flagOf(country.iso),
    name: String(names.of(country.iso)),
  })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

const TELEGRAM_HANDLE = /^@?\w{3,}$/;

// TODO: /min metadata accepts numbers no carrier issues, e.g. +3813012345678
// (a German national number typed while the picker still shows RS).
// isPossible() does not help — 10 national digits is a possible RS length.
// Only libphonenumber-js/max rejects it, and it costs +41 KB gzip on the
// approved.rs LeadForm chunk (37 KB -> 79 KB). Left on /min on purpose.

export function isValidContact(
  contact: string,
  channel: TrackedContactChannel | null,
): boolean {
  if (channel === 'telegram') return TELEGRAM_HANDLE.test(contact);
  return parsePhoneNumberFromString(contact)?.isValid() ?? false;
}
