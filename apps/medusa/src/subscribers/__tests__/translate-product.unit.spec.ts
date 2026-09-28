import { translateProduct } from '../../lib/translate-product';
import translateProductSubscriber, { config } from '../translate-product';

jest.mock('../../lib/translate-product', () => ({
  translateProduct: jest.fn(),
}));

describe('the translate-product subscriber', () => {
  it('translates the product the event names', async () => {
    const container = { resolve: jest.fn() };

    await translateProductSubscriber({
      event: { name: 'product.updated', data: { id: 'prod_1' } },
      container,
    } as never);

    expect(translateProduct).toHaveBeenCalledWith(container, 'prod_1');
  });

  it('listens to product creates and edits, the workflow events', () => {
    expect(config.event).toEqual(['product.created', 'product.updated']);
  });
});
