import { describe, expect, it } from 'vitest';
import {
  type CategoryFieldDefinition,
  guardDefinitionChange,
  matchesRequirements,
  validateAttributes,
} from './attributes.ts';

const oilFields: CategoryFieldDefinition[] = [
  {
    key: 'viscosity',
    type: 'single-select',
    required: true,
    options: [{ key: '5w-30' }, { key: '0w-20' }],
  },
  {
    key: 'approvals',
    type: 'multi-select',
    required: false,
    options: [{ key: 'bmw-ll-04' }, { key: 'mb-229-51' }, { key: 'vw-504-00' }],
  },
  { key: 'volume', type: 'number', required: false, options: [] },
  { key: 'synthetic', type: 'boolean', required: false, options: [] },
  { key: 'code', type: 'text', required: false, options: [] },
];

describe('validateAttributes', () => {
  it('accepts values that keep to the definition', () => {
    const values = {
      viscosity: '5w-30',
      approvals: ['bmw-ll-04', 'mb-229-51'],
      volume: 5,
      synthetic: true,
      code: 'H7',
    };

    expect(validateAttributes(oilFields, values)).toEqual({
      success: true,
      values,
    });
  });

  it.each([
    ['an unknown field', { viscosity: '5w-30', colour: 'red' }],
    ['a missing required field', { volume: 5 }],
    ['an unknown single option', { viscosity: '10w-60' }],
    ['an unknown multi option', { viscosity: '5w-30', approvals: ['nope'] }],
    ['an empty multi select', { viscosity: '5w-30', approvals: [] }],
    [
      'a repeated multi option',
      { viscosity: '5w-30', approvals: ['bmw-ll-04', 'bmw-ll-04'] },
    ],
    ['a number as text', { viscosity: '5w-30', volume: '5' }],
    ['an infinite number', { viscosity: '5w-30', volume: Infinity }],
    ['a boolean as text', { viscosity: '5w-30', synthetic: 'yes' }],
    ['a blank text code', { viscosity: '5w-30', code: ' ' }],
    ['something other than an object', ['5w-30']],
  ])('refuses %s', (_, values) => {
    const result = validateAttributes(oilFields, values);

    expect(result.success).toBe(false);
    expect(result.success || result.errors.length).toBeGreaterThan(0);
  });

  it('names the field that broke the definition', () => {
    expect(validateAttributes(oilFields, { viscosity: '10w-60' })).toEqual({
      success: false,
      errors: [expect.stringContaining('viscosity')],
    });
  });

  it('refuses any value for a select field without options', () => {
    const fields: CategoryFieldDefinition[] = [
      { key: 'thread', type: 'single-select', required: false, options: [] },
    ];

    expect(validateAttributes(fields, { thread: 'm20' }).success).toBe(false);
    expect(validateAttributes(fields, {}).success).toBe(true);
  });
});

describe('matchesRequirements', () => {
  const oil = {
    viscosity: '5w-30',
    approvals: ['bmw-ll-04', 'mb-229-51'],
    volume: 5,
    synthetic: true,
  };

  it('matches a B47 approval and an OM654 approval with the same oil', () => {
    expect(
      matchesRequirements(oil, [
        { field_key: 'approvals', option_keys: ['bmw-ll-04'] },
      ]),
    ).toBe(true);
    expect(
      matchesRequirements(oil, [
        { field_key: 'approvals', option_keys: ['mb-229-51', 'mb-229-52'] },
      ]),
    ).toBe(true);
  });

  it('wants every Requirement to hold', () => {
    const requirements = [
      { field_key: 'approvals', option_keys: ['bmw-ll-04'] },
      { field_key: 'viscosity', option_keys: ['0w-20'] },
    ];

    expect(matchesRequirements(oil, requirements)).toBe(false);
  });

  it.each([
    [{ field_key: 'volume', min: 4, max: 6 }, true],
    [{ field_key: 'volume', min: 5, max: null }, true],
    [{ field_key: 'volume', max: 5 }, true],
    [{ field_key: 'volume', min: 5.5 }, false],
    [{ field_key: 'volume', max: 4.9 }, false],
    [{ field_key: 'viscosity', option_keys: ['5w-30', '0w-20'] }, true],
    [{ field_key: 'viscosity', option_keys: ['0w-20'] }, false],
    [{ field_key: 'approvals', option_keys: ['vw-504-00'] }, false],
    [{ field_key: 'synthetic', option_keys: ['true'] }, true],
    [{ field_key: 'synthetic' }, false],
    [{ field_key: 'code', option_keys: ['H7'] }, false],
  ])('reads %j as %s', (requirement, expected) => {
    expect(matchesRequirements(oil, [requirement])).toBe(expected);
  });

  it('matches a bulb by its text code', () => {
    expect(
      matchesRequirements({ code: 'H7' }, [
        { field_key: 'code', option_keys: ['H7', 'H11'] },
      ]),
    ).toBe(true);
  });

  it('holds when there is nothing to require', () => {
    expect(matchesRequirements({}, [])).toBe(true);
  });
});

describe('guardDefinitionChange', () => {
  const parts = [
    {
      id: 'part_1',
      attributes: { viscosity: '5w-30', approvals: ['bmw-ll-04'] },
    },
    { id: 'part_2', attributes: { viscosity: '0w-20' } },
  ];
  const without = (key: string) =>
    oilFields.filter((field) => field.key !== key);
  const withField = (key: string, change: Partial<CategoryFieldDefinition>) =>
    oilFields.map((field) =>
      field.key === key ? { ...field, ...change } : field,
    );

  it('lets an option be renamed, since only its label changes', () => {
    expect(guardDefinitionChange(oilFields, parts)).toEqual([]);
  });

  it('refuses deleting a field a Part uses', () => {
    expect(guardDefinitionChange(without('approvals'), parts)).toEqual([
      'part_1',
    ]);
  });

  it('lets an unused field go', () => {
    expect(guardDefinitionChange(without('volume'), parts)).toEqual([]);
  });

  it('refuses deleting an option a Part uses', () => {
    const next = withField('viscosity', { options: [{ key: '5w-30' }] });

    expect(guardDefinitionChange(next, parts)).toEqual(['part_2']);
  });

  it('refuses retyping a field a Part uses', () => {
    expect(
      guardDefinitionChange(withField('approvals', { type: 'text' }), parts),
    ).toEqual(['part_1']);
  });

  it('refuses making a field required while a Part lacks it', () => {
    expect(
      guardDefinitionChange(withField('approvals', { required: true }), parts),
    ).toEqual(['part_2']);
  });
});
