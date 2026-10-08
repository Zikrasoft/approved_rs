import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from './config';
import { content } from './content';
import { SECTIONS } from './sections';

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('returns every registered section', () => {
    expect(Object.keys(content(locale)).sort()).toEqual(
      SECTIONS.map(({ key }) => key).sort(),
    );
  });
});
