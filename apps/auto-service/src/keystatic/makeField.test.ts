import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@keystar/ui/combobox';
import { MAKES, type Make } from '@/utils/makes';
import { makeField } from './makeField';

const field = makeField({ label: 'Марка' });

type Dropdown = {
  type: unknown;
  props: {
    onChange(key: string | null): void;
    children(make: Make): { key: string; props: { children: string } };
  };
};

const dropdown = (value: string | null, onChange = vi.fn()) =>
  field.Input({
    value,
    onChange,
    autoFocus: false,
    forceValidation: false,
  }) as unknown as Dropdown;

describe('the Make field', () => {
  it('stores a chosen Make as its catalogue slug', () => {
    expect(field.parse('bmw')).toBe('bmw');
    expect(field.serialize('bmw')).toEqual({ value: 'bmw' });
    expect(field.reader.parse('skoda')).toBe('skoda');
  });

  it('is optional: an entry without a Make keeps no value', () => {
    expect(field.defaultValue()).toBeNull();
    expect(field.parse(undefined)).toBeNull();
    expect(field.validate(null)).toBeNull();
    expect(field.serialize(null)).toEqual({ value: undefined });
  });

  it('refuses a Make the catalogue does not know', () => {
    expect(() => field.parse('zastava')).toThrow();
    expect(() => field.reader.parse(42)).toThrow();
  });

  it('offers every exported Make in a searchable dropdown', () => {
    const input = dropdown('bmw');

    expect(input.type).toBe(Combobox);
    expect(input.props).toMatchObject({
      label: 'Марка',
      value: 'bmw',
      defaultItems: MAKES,
    });
    const item = input.props.children(MAKES[0]);
    expect(item.key).toBe(MAKES[0].slug);
    expect(item.props.children).toBe(MAKES[0].name);
  });

  it('hands the dropdown choice to the entry, a cleared one as no Make', () => {
    const onChange = vi.fn();
    const { props } = dropdown(null, onChange);

    props.onChange('audi');
    props.onChange(null);

    expect(onChange.mock.calls).toEqual([['audi'], [null]]);
  });
});
