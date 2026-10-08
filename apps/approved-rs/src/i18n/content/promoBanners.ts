import type { Locale } from '@/i18n/config';
import { content } from '@/i18n/content';

export function getPromoBanners(locale: Locale): string[] {
  return content(locale).promoBanners.sourcing;
}
