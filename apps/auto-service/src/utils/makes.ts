import {
  makeListSchema,
  type CatalogueMake,
  type Make,
} from '@podbor/catalog-contract';
import makeList from '../content/makes.json';

export type { Make };

export const MAKES: CatalogueMake[] = makeListSchema.parse(makeList);

export const MAKE_SLUGS = MAKES.map(({ slug }) => slug);

export const makeName = (slug: string): string | undefined =>
  MAKES.find((make) => make.slug === slug)?.name;
