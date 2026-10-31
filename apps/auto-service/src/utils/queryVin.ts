import { vinOf } from '@podbor/lead-crm/vin';

const RUSSIAN_KEYS = 'йцукенгшщзфывапролдячсмить';
const LATIN_KEYS = 'qwertyuiopasdfghjklzxcvbnm';

const fromRussianLayout = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[а-я]/g, (key) => LATIN_KEYS[RUSSIAN_KEYS.indexOf(key)] ?? key);

const withoutGluedLabel = (text: string): string =>
  text.replace(/^\s*vin(?=[a-z0-9]{17}\s*$)/i, '');

export const queryVin = (q: string): string | null =>
  vinOf(withoutGluedLabel(q)) ?? vinOf(withoutGluedLabel(fromRussianLayout(q)));
