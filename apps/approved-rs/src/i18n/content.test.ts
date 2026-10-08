import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { translationIsCurrent } from '@podbor/i18n';
import { SUPPORTED_LOCALES } from './config';
import { content } from './content';
import { SECTIONS } from './sections';

const translated = SECTIONS.every(({ path, schema }) =>
  translationIsCurrent(readFileSync(path, 'utf-8'), schema),
);

describe.each(SUPPORTED_LOCALES)('content for %s', (locale) => {
  it('returns every registered section', () => {
    expect(Object.keys(content(locale)).sort()).toEqual(
      SECTIONS.map(({ key }) => key).sort(),
    );
  });

  it.skipIf(!translated)(
    'loads a real translation for every section, never a silent ru fallback',
    () => {
      const russian = content('ru');
      Object.entries(content(locale)).forEach(([name, section]) => {
        const current = JSON.stringify(section);
        const ru = JSON.stringify(russian[name as keyof typeof russian]);
        if (locale === 'ru') {
          expect(current).toBe(ru);
        } else {
          expect(current, `${name} fell back to ru`).not.toBe(ru);
        }
      });
    },
  );
});
