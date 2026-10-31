import type { TranslatableLocale } from './config';

export const TARGET_LANGUAGE_NAME: Record<TranslatableLocale, string> = {
  sr: 'Serbian (Latin script)',
  en: 'English',
};

export const LOCALE_GUIDANCE: Partial<Record<TranslatableLocale, string>> = {
  sr:
    'A waiting time is "za": "через {days}" and "забрать через {days}" become "za {days}" and ' +
    '"preuzimanje za {days}", a bare "Через" before a number of days is "Za", never "kroz". ' +
    'Mind the case after "u": "в корзине" (where) is "u korpi", "в корзину" (where to) is "u korpu".',
  en:
    'Write interface labels and headings the way an English shop would, in sentence case: ' +
    '"Подходит для автомобилей" is "Fits these cars", never "Fits for Vehicles".',
};

export const BUSINESS_DESCRIPTION =
  'CarLab, an independent car service in Belgrade, Serbia — diagnostics, servicing, brakes and suspension, engine and gearbox work, accident repair and respraying, plus a parts counter selling car batteries';
