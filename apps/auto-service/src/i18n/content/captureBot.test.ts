import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { content } from '@/i18n/content';

describe('captureBot copy', () => {
  it('has every line the capture dialog sends, in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const copy = content(locale).captureBot;
      for (const line of Object.values(copy).flatMap((group) =>
        typeof group === 'string' ? group : Object.values(group),
      ))
        expect(line.trim()).not.toBe('');
    }
  });

  it('is written for each language rather than copied from ru', () => {
    for (const locale of SUPPORTED_LOCALES.filter((l) => l !== 'ru')) {
      expect(content(locale).captureBot.lookingFor).not.toBe(
        content('ru').captureBot.lookingFor,
      );
    }
  });
});
