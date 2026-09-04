import type { Locale } from './config';
import { ru } from './dictionaries/ru';
import { en } from './dictionaries/en';
import { sr } from './dictionaries/sr';
import { es } from './dictionaries/es';
import { de } from './dictionaries/de';

const dictionaries = { ru, en, sr, es, de };

export function getI18n(locale: Locale) {
  return dictionaries[locale];
}
