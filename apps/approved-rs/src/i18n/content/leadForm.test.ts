import { describe, it, expect } from 'vitest';
import { content } from '@/i18n/content';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('content().leadForm', () => {
  it('returns every field non-empty for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const leadForm = content(locale).leadForm;
      for (const [key, value] of Object.entries(leadForm)) {
        expect(value, `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(content('en').leadForm.headingLine1).not.toBe(
      content('ru').leadForm.headingLine1,
    );
    expect(content('sr').leadForm.headingLine1).not.toBe(
      content('ru').leadForm.headingLine1,
    );
    expect(content('es').leadForm.headingLine1).not.toBe(
      content('ru').leadForm.headingLine1,
    );
    expect(content('de').leadForm.headingLine1).not.toBe(
      content('ru').leadForm.headingLine1,
    );
  });
});
