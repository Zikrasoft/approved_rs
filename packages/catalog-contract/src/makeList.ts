import { z } from 'zod';

export const makeSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const makeListSchema = z.array(makeSchema);

export type Make = z.infer<typeof makeSchema>;

const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare;

export const sameMakeName = (a: string, b: string): boolean =>
  byName(a, b) === 0;

export const sortedMakes = (makes: readonly Make[]): Make[] =>
  makes
    .map(({ slug, name }) => ({ slug, name }))
    .sort((a, b) => byName(a.name, b.name));
