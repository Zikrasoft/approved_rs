import type { MedusaContainer } from '@medusajs/framework/types';

import { prewarmCatalogue } from '../prewarm-run';

describe('prewarmCatalogue', () => {
  const origin = process.env.STOREFRONT_ORIGIN;
  afterEach(() => {
    process.env.STOREFRONT_ORIGIN = origin;
    if (origin === undefined) delete process.env.STOREFRONT_ORIGIN;
  });

  it('warms nothing while STOREFRONT_ORIGIN is unset', async () => {
    delete process.env.STOREFRONT_ORIGIN;
    const resolve = jest.fn();
    const fetch = jest.spyOn(globalThis, 'fetch');

    expect(
      await prewarmCatalogue({ resolve } as unknown as MedusaContainer),
    ).toBeNull();

    expect(resolve).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
