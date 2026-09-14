import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { getSiteContent } from '@/i18n/content/site';
import { OPENING_HOURS } from './constants';

const scheduled = OPENING_HOURS.flatMap((spec) => [spec.opens, spec.closes]);

describe('opening hours', () => {
  it.each(SUPPORTED_LOCALES)(
    'footer copy for %s matches the JSON-LD schedule',
    (locale) => {
      expect(getSiteContent(locale).footer.hours.match(/\d{2}:\d{2}/g)).toEqual(
        scheduled,
      );
    },
  );
});
