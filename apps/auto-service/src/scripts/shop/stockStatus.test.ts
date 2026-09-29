// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const stock = vi.hoisted(() => ({
  fetchStock: vi.fn(),
  STOCK_EVENT: 'carlab:stock',
}));
vi.mock('./stock', () => stock);

const { defineStockStatus } = await import('./stockStatus');

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const mount = async () => {
  document.body.innerHTML = `<stock-status data-handle="bosch" data-variant="var_1"
    data-in="Na stanju" data-out="Nema" data-low="Još {count} kom.">Na stanju</stock-status>`;
  await settle();
  return document.querySelector<HTMLElement>('stock-status')!;
};

beforeAll(() => defineStockStatus());
beforeEach(() => vi.clearAllMocks());

describe('<stock-status>', () => {
  it.each([
    [5, 'in', 'Na stanju'],
    [2, 'low', 'Još 2 kom.'],
    [0, 'out', 'Nema'],
    [null, 'in', 'Na stanju'],
  ])('shows %s pieces as %s', async (quantity, state, text) => {
    stock.fetchStock.mockResolvedValue(quantity);
    const heard = vi.fn();
    window.addEventListener('carlab:stock', heard);

    const node = await mount();

    expect([node.dataset.state, node.textContent]).toEqual([state, text]);
    expect(heard.mock.calls[0][0].detail).toEqual({
      variantId: 'var_1',
      quantity,
    });
    window.removeEventListener('carlab:stock', heard);
  });

  it('keeps the baked text when the store cannot be reached', async () => {
    stock.fetchStock.mockRejectedValue(new TypeError('Failed to fetch'));

    const node = await mount();

    expect(node.textContent).toBe('Na stanju');
    expect(node.dataset.state).toBeUndefined();
  });
});
