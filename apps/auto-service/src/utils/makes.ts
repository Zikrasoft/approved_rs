import { z } from 'zod';
import makeList from '../content/makes.json';

const MAKE_LIST_FILE = 'src/content/makes.json';

export type Make = { slug: string; name: string };

export const MAKES: Make[] = z
  .array(z.strictObject({ slug: z.string().min(1), name: z.string().min(1) }))
  .parse(makeList);

export const MAKE_SLUGS = MAKES.map(({ slug }) => slug);

export const makeName = (slug: string): string | undefined =>
  MAKES.find((make) => make.slug === slug)?.name;

const sameName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

export const makeDrift = (catalogue: Make[], exported = MAKES): string[] =>
  [...new Map(catalogue.map((make) => [make.slug, make])).values()].flatMap(
    ({ slug, name }) => {
      if (exported.some((make) => make.slug === slug)) return [];
      const renamed = exported.find((make) => !sameName(make.name, name));
      return [
        renamed
          ? `Make ${renamed.name} is ${slug} in the catalogue but ${renamed.slug} in ${MAKE_LIST_FILE}`
          : `Make ${slug} (${name}) is in the catalogue but not in ${MAKE_LIST_FILE}`,
      ];
    },
  );
