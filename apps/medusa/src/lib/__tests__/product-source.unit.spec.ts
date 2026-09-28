import { productSource, sourceHash } from '../product-source';

describe('productSource', () => {
  it('keeps the Russian fields a translator should see, trimmed', () => {
    expect(
      productSource({
        title: ' Varta E12 ',
        subtitle: null,
        description: 'Для **VW**',
      }),
    ).toEqual({ title: 'Varta E12', description: 'Для **VW**' });
  });

  it('drops blank fields', () => {
    expect(
      productSource({ title: 'A', subtitle: '  ', description: '' }),
    ).toEqual({ title: 'A' });
  });

  it('ignores everything else on the product', () => {
    expect(
      productSource({ title: 'A', handle: 'a' } as { title: string }),
    ).toEqual({ title: 'A' });
  });
});

describe('sourceHash', () => {
  it('is stable for the same Russian text', () => {
    expect(sourceHash({ title: 'A' })).toBe(sourceHash({ title: 'A' }));
  });

  it('moves when any field moves', () => {
    expect(sourceHash({ title: 'A', description: 'x' })).not.toBe(
      sourceHash({ title: 'A', description: 'y' }),
    );
  });

  it('is the 16-hex digest the YAML pipeline uses', () => {
    expect(sourceHash({ title: 'A' })).toMatch(/^[0-9a-f]{16}$/);
  });
});
