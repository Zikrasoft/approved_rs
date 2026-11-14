type Make = { slug: string; name: string };

const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

export const makeListJson = (makes: Make[]): string =>
  `${JSON.stringify(
    makes
      .map(({ slug, name }) => ({ slug, name }))
      .sort((a, b) => byName(a.name, b.name)),
    null,
    2,
  )}\n`;
