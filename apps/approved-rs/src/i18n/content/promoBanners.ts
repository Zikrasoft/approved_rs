import promoBannersYaml from '@/content/i18n/promoBanners.yaml?raw';
import type { Locale } from '@/i18n/config';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { promoBannersContentSchema } from './promoBannersContentSchema';

// Admin hand-edits ru fields directly in promoBanners.yaml; en/sr/es/de
// filled in by scripts/translate-i18n.ts (.github/workflows/translate.yml)
// — same pattern as src/i18n/getI18n.ts/src/i18n/content/faq.ts.
const getPromoBannersContent = loadI18nSection(
  promoBannersContentSchema,
  promoBannersYaml,
);

export function getPromoBanners(locale: Locale): string[] {
  return getPromoBannersContent(locale).sourcing;
}
