import { describe, it, expect } from 'vitest';
import { PRODUCT_TYPES, SERVICE_TYPE, productType } from './registry.ts';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELD_KEY = /^[a-z][a-zA-Z0-9]*$/;

describe('PRODUCT_TYPES', () => {
  it('starts with the four launch types', () => {
    expect(PRODUCT_TYPES.map((type) => type.key)).toEqual([
      'batteries',
      'motor-oils',
      'filters',
      'brakes',
    ]);
  });

  it('uses unique URL-safe keys that never collide with the services type', () => {
    const keys = PRODUCT_TYPES.map((type) => type.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(SLUG);
    expect(keys).not.toContain(SERVICE_TYPE);
  });

  it('gives every type unique camelCase field keys and a label on each', () => {
    for (const type of PRODUCT_TYPES) {
      const keys = type.fields.map((field) => field.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const field of type.fields) {
        expect(field.key).toMatch(FIELD_KEY);
        expect(field.label.trim()).not.toBe('');
      }
    }
  });

  it('gives every enum unique URL-safe values with labels', () => {
    for (const type of PRODUCT_TYPES) {
      for (const field of type.fields) {
        if (field.kind !== 'enum') continue;
        const values = field.values.map((option) => option.value);
        expect(values.length).toBeGreaterThan(0);
        expect(new Set(values).size).toBe(values.length);
        for (const option of field.values) {
          expect(option.value).toMatch(SLUG);
          expect(option.label.trim()).not.toBe('');
        }
      }
    }
  });

  it('keeps numeric bounds ordered', () => {
    for (const type of PRODUCT_TYPES) {
      for (const field of type.fields) {
        if (field.kind !== 'number') continue;
        if (field.min !== undefined && field.max !== undefined) {
          expect(field.min).toBeLessThan(field.max);
        }
      }
    }
  });

  it('offers landing pages only on filterable, non-boolean fields', () => {
    for (const type of PRODUCT_TYPES) {
      for (const field of type.fields) {
        if (!field.landing) continue;
        expect(field.facet).toBe(true);
        expect(field.kind).not.toBe('boolean');
      }
    }
  });

  it('keeps boolean fields out of the filter until the filter UI supports them', () => {
    for (const type of PRODUCT_TYPES) {
      for (const field of type.fields) {
        if (field.kind === 'boolean') expect(field.facet).toBeFalsy();
      }
    }
  });

  it('names a unique URL-safe installation service wherever one is offered', () => {
    const handles = PRODUCT_TYPES.flatMap((type) =>
      type.installation ? [type.installation] : [],
    );
    expect(handles).toEqual(['battery-installation', 'brake-installation']);
    for (const handle of handles) expect(handle).toMatch(SLUG);
  });

  it('requires fitment where a part only fits certain cars', () => {
    expect(productType('filters')?.fitment).toBe('required');
    expect(productType('brakes')?.fitment).toBe('required');
    expect(productType('motor-oils')?.fitment).toBe('none');
    expect(productType('batteries')?.fitment).toBe('optional');
  });
});

describe('productType', () => {
  it('finds a type by key', () => {
    expect(productType('batteries')?.label).toBe('Аккумуляторы');
  });

  it.each([SERVICE_TYPE, 'unknown', '', 'constructor', '__proto__'])(
    'returns undefined for %j',
    (key) => {
      expect(productType(key)).toBeUndefined();
    },
  );
});
