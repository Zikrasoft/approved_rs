import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { translationIsCurrent } from '@podbor/i18n';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SECTIONS } from '@/i18n/sections';
import { OPENING_HOURS } from './constants';
import { content } from '@/i18n/content';

const scheduled = OPENING_HOURS.flatMap((spec) => [spec.opens, spec.closes]);
const site = SECTIONS.find(({ key }) => key === 'site')!;
const siteTranslated = translationIsCurrent(
  readFileSync(site.path, 'utf-8'),
  site.schema,
);

describe('opening hours', () => {
  it.each(SUPPORTED_LOCALES)(
    'footer copy for %s matches the JSON-LD schedule',
    (locale) => {
      if (locale !== 'ru' && !siteTranslated) return;
      expect(content(locale).site.footer.hours.match(/\d{2}:\d{2}/g)).toEqual(
        scheduled,
      );
    },
  );
});
