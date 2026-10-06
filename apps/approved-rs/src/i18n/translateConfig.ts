import type { TranslatableLocale } from './config';

export const TARGET_LANGUAGE_NAME: Record<TranslatableLocale, string> = {
  en: 'English',
  sr: 'Serbian (Latin script)',
  es: 'Spanish',
  de: 'German',
};

export const BUSINESS_DESCRIPTION =
  'approved.rs, a car-sourcing/import/buyback/inspection business based in Belgrade, Serbia';

export const LOCALE_GUIDANCE: Partial<Record<TranslatableLocale, string>> = {
  sr:
    'Serbian visitors search for "provera auta pre kupovine". Whenever the Russian speaks of ' +
    'inspecting, checking or examining a car before buying it (проверка, осмотр, диагностика ' +
    'перед покупкой), write "provera auta pre kupovine" — that exact phrase is the primary ' +
    'wording. Use a natural variation (provera polovnog auta, pregled auta pre kupovine, ' +
    'provera automobila pre kupovine) only where repeating it would read unnaturally. A ' +
    'metaTitle, metaDescription, title or description whose key names vehicle-inspection ' +
    'must contain the exact phrase.',
};
