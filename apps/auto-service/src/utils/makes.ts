import {
  makeListSchema,
  sameMakeName,
  type Make,
} from '@podbor/catalog-contract';
import makeList from '../content/makes.json';

const MAKE_LIST_FILE = 'src/content/makes.json';

export type { Make };

export const MAKES: Make[] = makeListSchema.parse(makeList);

export const MAKE_SLUGS = MAKES.map(({ slug }) => slug);

export const makeName = (slug: string): string | undefined =>
  MAKES.find((make) => make.slug === slug)?.name;

export const makeDrift = (catalogue: Make[], exported = MAKES): string[] =>
  [...new Map(catalogue.map((make) => [make.slug, make])).values()].flatMap(
    ({ slug, name }) => {
      if (exported.some((make) => make.slug === slug)) return [];
      const renamed = exported.find((make) => sameMakeName(make.name, name));
      return [
        renamed
          ? `Make ${renamed.name} is ${slug} in the catalogue but ${renamed.slug} in ${MAKE_LIST_FILE}`
          : `Make ${slug} (${name}) is in the catalogue but not in ${MAKE_LIST_FILE}`,
      ];
    },
  );
