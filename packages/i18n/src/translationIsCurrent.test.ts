import { describe, it, expect } from 'vitest';
import { stringify } from 'yaml';
import { z } from 'zod';
import { sha256Hex } from './translate/sha256Hex.ts';
import { translationIsCurrent } from './translationIsCurrent.ts';

const navSchema = z
  .object({
    nav: z.object({ home: z.string(), cases: z.string() }).strict(),
    footer: z.object({ tagline: z.string() }).strict(),
  })
  .strict();

const RU_NAV = {
  nav: { home: 'Главная', cases: 'Кейсы' },
  footer: { tagline: 'Слоган' },
};

const hashSource = (data: object) => sha256Hex(JSON.stringify(data));

describe('translationIsCurrent', () => {
  const withHash = (data: object, hash: string) =>
    stringify({ ...data, translations: {}, translatedFrom: hash });

  it('is true when the stored hash matches the ru source', () => {
    const text = withHash(RU_NAV, hashSource(RU_NAV));
    expect(translationIsCurrent(text, navSchema)).toBe(true);
  });

  it('is false once the ru source has moved on', () => {
    const text = withHash(RU_NAV, 'stale');
    expect(translationIsCurrent(text, navSchema)).toBe(false);
  });

  it('is false when no hash was ever recorded', () => {
    expect(translationIsCurrent(stringify(RU_NAV), navSchema)).toBe(false);
  });

  it('is false when the ru source no longer matches the schema', () => {
    const broken = { nav: { home: 'Главная' }, footer: { tagline: 'x' } };
    const text = withHash(broken, hashSource(broken));
    expect(translationIsCurrent(text, navSchema)).toBe(false);
  });

  it('ignores keys outside the section fields', () => {
    const text = withHash({ ...RU_NAV, extra: 'ignored' }, hashSource(RU_NAV));
    expect(translationIsCurrent(text, navSchema)).toBe(true);
  });
});
