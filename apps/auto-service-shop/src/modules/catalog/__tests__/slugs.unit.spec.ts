import {
  refuseReservedSection,
  retirementOf,
  scopedKind,
  slugScopeOf,
} from '../slugs';

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

  it('sends a deleted page to the place that still holds it', () => {
    const number = {
      id: 'pi_1',
      brand: { slug: 'mann' },
      normalized_value: 'HU816X',
    };

    expect(
      retirementOf.part({ ...number, part: { category_id: 'cat_1' } }),
    ).toMatchObject({
      scope_id: null,
      target_kind: 'category',
      target_id: 'cat_1',
    });
    expect(
      retirementOf.part({ ...number, part: { category_id: null } }),
    ).toMatchObject({ target_kind: null, target_id: null });
    expect(
      retirementOf.vehicle({ id: 'v_1', slug: 'b47', model_id: 'mod_1' }),
    ).toEqual({
      id: 'v_1',
      slug: 'b47',
      scope_id: 'mod_1',
      target_kind: 'model',
      target_id: 'mod_1',
    });
    expect(
      retirementOf.model({ id: 'mod_1', slug: 'f30', make_id: 'make_1' }),
    ).toMatchObject({
      scope_id: 'make_1',
      target_kind: 'make',
      target_id: 'make_1',
    });
    expect(retirementOf.unscoped({ id: 'b_1', slug: 'mann' })).toEqual({
      id: 'b_1',
      slug: 'mann',
      scope_id: null,
      target_kind: null,
      target_id: null,
    });
  });
});
