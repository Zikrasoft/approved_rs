import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { CATALOG_MODULE } from '../../../modules/catalog';
import { SUPPLIER_MODULE } from '../../../modules/supplier';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../adapter';
import { liveOffers } from '../live-quote';

const stored = {
  id: 'offer_1',
  supplier_article_id: 'IC-1',
  part_identifier_id: 'pi_1',
  cost_price: 1000,
  currency: 'RSD',
  stock_quantity: 4,
  lead_time_days: 1,
  supplier: { name: 'Intercars', markup_percentage: 20 },
};

function scopeQuoting(cost_price: number, quantity: number) {
  const updateSupplierOffers = jest.fn();
  const emit = jest.fn();
  const services: Record<string, unknown> = {
    [SUPPLIER_MODULE]: {
      listSupplierOffers: async () => [stored],
      updateSupplierOffers,
    },
    [CATALOG_MODULE]: {
      listPartIdentifiers: async () => [{ id: 'pi_1', part_id: 'part_1' }],
    },
    [SUPPLIER_ADAPTERS_REGISTRATION]: [
      {
        name: 'Intercars',
        quote: async () => [
          {
            article_id: 'IC-1',
            cost_price,
            currency: 'RSD',
            stock: [{ location: 'Beograd', quantity }],
            lead_time_days: 1,
          },
        ],
      },
    ],
    [Modules.EVENT_BUS]: { emit },
    [Modules.SEARCH]: {
      listIndexes: async () => [{ name: 'part_identifier', status: 'ready' }],
    },
  };
  const scope = {
    hasRegistration: () => true,
    resolve: (name: string) => services[name],
  } as unknown as MedusaContainer;
  return { scope, updateSupplierOffers, emit };
}

describe('liveOffers', () => {
  it('keeps the stored offer when the supplier quotes a price that sells for nothing', async () => {
    const { scope, updateSupplierOffers, emit } = scopeQuoting(0.3, 4);

    expect(await liveOffers(scope, { id: ['offer_1'] })).toEqual([]);
    expect(updateSupplierOffers).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('reindexes the Part when a live quote moves its price or stock', async () => {
    const { scope, updateSupplierOffers, emit } = scopeQuoting(2000, 0);

    const [offer] = await liveOffers(scope, { id: ['offer_1'] });

    expect(offer).toMatchObject({ cost_price: 2000, stock_quantity: 0 });
    expect(updateSupplierOffers).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'offer_1', cost_price: 2000 }),
    );
    expect(emit).toHaveBeenCalledWith([
      { name: 'parts.part.changed', data: { part_id: 'part_1' } },
    ]);
  });

  it('writes and reindexes nothing when the live quote matches the stored offer', async () => {
    const { scope, updateSupplierOffers, emit } = scopeQuoting(1000, 4);

    expect(await liveOffers(scope, { id: ['offer_1'] })).toHaveLength(1);
    expect(updateSupplierOffers).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
