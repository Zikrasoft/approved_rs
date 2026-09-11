import { describe, it, expect } from 'vitest';
import { getLeadFormContent } from './leadForm';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getLeadFormContent', () => {
  it('returns every field non-empty for every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const content = getLeadFormContent(locale);
      for (const [key, value] of Object.entries(content)) {
        expect(value, `${locale}.${key}`).toBeTruthy();
      }
    }
  });

  it('en, sr, es and de contain different text than ru (real translations, not copies)', () => {
    expect(getLeadFormContent('en').headingLine1).not.toBe(
      getLeadFormContent('ru').headingLine1,
    );
    expect(getLeadFormContent('sr').headingLine1).not.toBe(
      getLeadFormContent('ru').headingLine1,
    );
    expect(getLeadFormContent('es').headingLine1).not.toBe(
      getLeadFormContent('ru').headingLine1,
    );
    expect(getLeadFormContent('de').headingLine1).not.toBe(
      getLeadFormContent('ru').headingLine1,
    );
  });
});
