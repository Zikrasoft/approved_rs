import { z } from 'zod';

// `title`/`description` hold the literal token "{location}" — real
// translatable strings (see pagesContentSchema.ts's privacy.metaDescription
// for the same pattern), not the `(location) => MetaText` functions the
// original hand-written MetaTemplates interface used. meta.ts wraps each
// field back into that function shape at read time so the one call site
// (src/utils/seo.ts) doesn't change.
const metaTextSchema = z
  .object({ title: z.string(), description: z.string() })
  .strict();

export const metaContentSchema = z
  .object({
    'vehicle-sourcing': metaTextSchema,
    'vehicle-buyback': metaTextSchema,
    'vehicle-inspection': metaTextSchema,
  })
  .strict();

export type MetaContentData = z.infer<typeof metaContentSchema>;
