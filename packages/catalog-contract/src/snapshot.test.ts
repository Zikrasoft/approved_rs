import { describe, expect, it } from 'vitest';
import { catalogueSnapshotResponseSchema } from './snapshot.ts';

const empty = { categories: [], pages: [], fitments: [], vehicles: [] };

describe('catalogueSnapshotResponseSchema', () => {
  it('reads a shop that sends a key the storefront does not know yet', () => {
    expect(
      catalogueSnapshotResponseSchema.parse({ ...empty, redirects: [] }),
    ).toEqual(empty);
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
