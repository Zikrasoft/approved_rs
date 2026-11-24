import { model } from '@medusajs/framework/utils';

import { provenance } from './provenance';

export const SLUG_KINDS = [
  'brand',
  'make',
  'model',
  'vehicle',
  'category',
  'part',
] as const;

export type SlugKind = (typeof SLUG_KINDS)[number];

// TODO: nothing reads or writes slug_redirect any more; drop this model and its table in the next deploy.
const SlugRedirect = model
  .define('slug_redirect', {
    id: model.id().primaryKey(),
    kind: model.enum([...SLUG_KINDS]),
    from_id: model.text(),
    from_slug: model.text(),
    scope_id: model.text().nullable(),
    target_kind: model.enum([...SLUG_KINDS]).nullable(),
    target_id: model.text().nullable(),
    ...provenance(),
  })
  .indexes([
    { on: ['kind', 'from_slug', 'scope_id'] },
    { on: ['target_kind', 'target_id'] },
    { on: ['kind', 'from_slug'], unique: true, where: { kind: 'part' } },
  ]);

export default SlugRedirect;
