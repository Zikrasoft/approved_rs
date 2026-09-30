import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStock } from './stock';

const fetchMock = vi.fn();
const answer = (variant: object) =>
  fetchMock.mockResolvedValue(
    Response.json({
      products: [
        {
          handle: 'bosch-s4-024',
          variants: [{ id: 'var_1', ...variant }],
        },
      ],
    }),
  );

beforeEach(() => {
  vi.stubEnv('PUBLIC_MEDUSA_BACKEND_URL', 'http://store.test');
  vi.stubEnv('PUBLIC_MEDUSA_PUBLISHABLE_KEY', 'pk_test');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('fetchStock', () => {
  it('reads the live quantity of a tracked variant', async () => {
    answer({
      manage_inventory: true,
      allow_backorder: false,
      inventory_quantity: 2,
    });

    expect(await fetchStock('bosch-s4-024', 'var_1')).toBe(2);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('handle')).toBe('bosch-s4-024');
    expect(url.searchParams.get('fields')).toContain(
      '+variants.inventory_quantity',
    );
  });

  it('answers null for a variant that is not counted', async () => {
    answer({ manage_inventory: false, allow_backorder: false });
    expect(await fetchStock('bosch-s4-024', 'var_1')).toBeNull();
    answer({
      manage_inventory: true,
      allow_backorder: true,
      inventory_quantity: 0,
    });
    expect(await fetchStock('bosch-s4-024', 'var_1')).toBeNull();
  });

  it('fails when the variant is gone', async () => {
    answer({ manage_inventory: true });
    await expect(fetchStock('bosch-s4-024', 'var_2')).rejects.toThrow(/var_2/);
  });
});
