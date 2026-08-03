import type { Locale } from './config';
import { ru } from './dictionaries/ru';
import { en } from './dictionaries/en';
import { sr } from './dictionaries/sr';

const dictionaries = { ru, en, sr };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
