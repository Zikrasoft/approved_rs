import { z } from 'zod';

export const makeSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const catalogueMakeSchema = makeSchema.extend({
  show_on_site: z.boolean().nullable().default(null),
});

export const makeListSchema = z.array(catalogueMakeSchema);

export type Make = z.infer<typeof makeSchema>;

export type CatalogueMake = z.infer<typeof catalogueMakeSchema>;

const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

export const sortedMakes = (makes: readonly CatalogueMake[]): CatalogueMake[] =>
  makes
    .map(({ slug, name, show_on_site }) => ({ slug, name, show_on_site }))
    .sort((a, b) => byName(a.name, b.name));
