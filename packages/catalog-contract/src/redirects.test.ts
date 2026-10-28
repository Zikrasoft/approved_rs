import { describe, expect, it } from 'vitest';

import { catalogueRedirectsResponseSchema } from './redirects.ts';

describe('catalogueRedirectsResponseSchema', () => {
  it('fills the places a redirect leaves out with null and strips an extra key', () => {
    expect(
      catalogueRedirectsResponseSchema.parse({
        redirects: [
          {
            from: { make: 'vw', since: '2026-10-28' },
            to: { make: 'volkswagen' },
          },
        ],
        generated_at: '2026-10-28',
      }),
    ).toEqual({
      redirects: [
        {
          from: {
            brand: null,
            make: 'vw',
            model: null,
            vehicle: null,
            category: null,
            part: null,
          },
          to: {
            brand: null,
            make: 'volkswagen',
            model: null,
            vehicle: null,
            category: null,
            part: null,
          },
        },
      ],
    });
  });
});
