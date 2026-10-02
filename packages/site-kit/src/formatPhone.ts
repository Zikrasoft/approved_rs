import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

export const formatPhone = (digits: string): string =>
  parsePhoneNumberFromString(`+${digits}`)?.formatInternational() ??
  `+${digits}`;
