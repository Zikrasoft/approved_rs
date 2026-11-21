import { describe, expect, it } from 'vitest';
import { catalogueSnapshotResponseSchema } from './snapshot.ts';

const empty = { categories: [], pages: [], fitments: [], vehicles: [] };

describe('catalogueSnapshotResponseSchema', () => {
  it('reads a shop that sends a key the storefront does not know yet', () => {
    expect(
      catalogueSnapshotResponseSchema.parse({ ...empty, redirects: [] }),
    ).toEqual({ ...empty, makes: null });
  });

  it('reads a shop that sends every catalogue Make with its site flag', () => {
    expect(
      catalogueSnapshotResponseSchema.parse({
        ...empty,
        makes: [{ slug: 'mini', name: 'MINI', show_on_site: true }],
      }).makes,
    ).toEqual([{ slug: 'mini', name: 'MINI', show_on_site: true }]);
  });

  it('refuses a snapshot missing a section rather than building without it', () => {
    expect(
      catalogueSnapshotResponseSchema.safeParse({
        ...empty,
        vehicles: undefined,
      }).success,
    ).toBe(false);
  });
});
