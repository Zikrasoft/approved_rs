import type { TFunction } from '../vehicle-label';
import { sourceLine } from '../vin-sources';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key) as unknown as TFunction;

describe('sourceLine', () => {
  it('names each source a code was searched from with its count', () => {
    expect(
      sourceLine(t, { storefront: 3, 'workshop-quote': 1, admin: 2 }),
    ).toBe(
      [
        'vinLookups.sources.storefront{"count":3}',
        'vinLookups.sources.workshop-quote{"count":1}',
        'vinLookups.sources.admin{"count":2}',
      ].join(' · '),
    );
  });

  it('leaves out a source the code was never searched from', () => {
    expect(
      sourceLine(t, { storefront: 0, 'workshop-quote': 4, admin: 0 }),
    ).toBe('vinLookups.sources.workshop-quote{"count":4}');
  });
});
