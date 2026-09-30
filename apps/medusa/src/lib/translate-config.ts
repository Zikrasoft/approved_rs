export const TARGET_LOCALES = ['sr', 'en'] as const;

export type TargetLocale = (typeof TARGET_LOCALES)[number];

export const TARGET_LANGUAGE_NAME: Record<TargetLocale, string> = {
  sr: 'Serbian (Latin script)',
  en: 'English',
};

export const BUSINESS_DESCRIPTION =
  'CarLab, an independent car service in Belgrade, Serbia, with a shop selling car batteries, motor oils, filters and brake parts for pickup at the workshop';

export const PRODUCT_PROMPT_SUBJECT =
  'a car parts shop product (title, short subtitle and markdown description)';
