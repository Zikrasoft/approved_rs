import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { OPENING_HOURS } from './constants';
import { content } from '@/i18n/content';

const scheduled = OPENING_HOURS.flatMap((spec) => [spec.opens, spec.closes]);

describe('opening hours', () => {
  it.each(SUPPORTED_LOCALES)(
    'footer copy for %s matches the JSON-LD schedule',
    (locale) => {
      expect(content(locale).site.footer.hours.match(/\d{2}:\d{2}/g)).toEqual(
        scheduled,
      );
    },
  );
});
