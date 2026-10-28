import en from '../../admin/i18n/translations/en.json';
import ru from '../../admin/i18n/translations/ru.json';

type Copy = { [key: string]: string | Copy };

const PLURAL = /_(zero|one|two|few|many|other)$/;

const entries = (copy: Copy, prefix = ''): [string, string][] =>
  Object.entries(copy).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value]]
      : entries(value, `${prefix}${key}.`),
  );

const keysOf = (copy: Copy) =>
  [...new Set(entries(copy).map(([key]) => key.replace(PLURAL, '')))].sort();

const pluralForms = (copy: Copy) => {
  const forms = new Map<string, string[]>();
  for (const [key] of entries(copy)) {
    const form = PLURAL.exec(key)?.[1];
    if (!form) continue;
    const base = key.replace(PLURAL, '');
    forms.set(base, [...(forms.get(base) ?? []), form].sort());
  }
  return forms;
};

describe('admin translations', () => {
  it('ru and en carry the same keys', () => {
    expect(keysOf(ru)).toEqual(keysOf(en));
  });

  it.each([
    ['ru', ru, ['few', 'many', 'one', 'other']],
    ['en', en, ['one', 'other']],
  ])('every %s plural has all its forms', (_, copy, forms) => {
    for (const [key, found] of pluralForms(copy)) {
      expect([key, found]).toEqual([key, forms]);
    }
  });

  it('ru copy has no Yo and no dashes', () => {
    expect(entries(ru).filter(([, value]) => /[ёЁ–—]/.test(value))).toEqual([]);
  });
});
