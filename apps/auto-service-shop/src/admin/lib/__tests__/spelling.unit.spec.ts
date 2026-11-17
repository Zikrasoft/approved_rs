import { spellingSchema, spellingSupplier } from '../spelling';

const suppliers = [{ id: 'sup_1', name: 'Mann' }];

describe('spellingSchema', () => {
  it('reads a spelling that belongs to no supplier', () => {
    expect(
      spellingSchema.parse({ id: 's', supplier_id: null, value: 'Blueprint' })
        .supplier_id,
    ).toBeNull();
  });
});

describe('spellingSupplier', () => {
  it('names the supplier a spelling belongs to', () => {
    expect(spellingSupplier('sup_1', suppliers, 'Все поставщики')).toBe('Mann');
  });

  it('falls back to the id of a supplier it does not know', () => {
    expect(spellingSupplier('sup_2', suppliers, 'Все поставщики')).toBe(
      'sup_2',
    );
  });

  it('labels a spelling of no supplier as every supplier', () => {
    expect(spellingSupplier(null, suppliers, 'Все поставщики')).toBe(
      'Все поставщики',
    );
  });
});
