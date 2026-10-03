import { describe, it, expect } from 'vitest';
import { getCaptureBotCopy } from './captureBot';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getCaptureBotCopy', () => {
  it('has every line the capture dialog sends, in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = getCaptureBotCopy(locale);
      for (const line of Object.values(copy)) expect(line.trim()).not.toBe('');
    }
  });

  it('is written for each language rather than copied from ru', () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== 'ru')) {
      expect(getCaptureBotCopy(locale).lookingFor).not.toBe(
        getCaptureBotCopy('ru').lookingFor,
      );
    }
  });
});
