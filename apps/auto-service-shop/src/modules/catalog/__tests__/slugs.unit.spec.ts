import { refuseReservedSection, scopedKind, slugScopeOf } from '../slugs';

describe('catalog slugs', () => {
  it('scopes a Vehicle slug by its Model and a Model slug by its Make', () => {
    expect(slugScopeOf('vehicle', { model_id: 'mod_1' })).toBe('mod_1');
    expect(slugScopeOf('model', { make_id: 'make_1' })).toBe('make_1');
    expect(slugScopeOf('make', { make_id: 'make_1' })).toBeNull();
    expect(scopedKind('brand')).toBe(false);
  });

  it('refuses a Make slug that is a storefront section, and only a Make one', () => {
    expect(() => refuseReservedSection('make', 'c')).toThrow(
      'This slug is a storefront section',
    );
    expect(() => refuseReservedSection('brand', 'c')).not.toThrow();
    expect(() => refuseReservedSection('make', 'bmw')).not.toThrow();
  });
});
