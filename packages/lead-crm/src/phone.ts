import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { TrackedContactChannel } from './contactChannel.ts';

export { composeE164 } from './composeE164.ts';

export const PHONE_COUNTRIES = [
  { iso: 'RS', dial: '381' },
  { iso: 'DE', dial: '49' },
  { iso: 'ES', dial: '34' },
  { iso: 'PT', dial: '351' },
  { iso: 'RU', dial: '7' },
  { iso: 'UA', dial: '380' },
  { iso: 'BY', dial: '375' },
  { iso: 'KZ', dial: '7' },
  { iso: 'BA', dial: '387' },
  { iso: 'HR', dial: '385' },
  { iso: 'ME', dial: '382' },
  { iso: 'MK', dial: '389' },
  { iso: 'TR', dial: '90' },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];

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
