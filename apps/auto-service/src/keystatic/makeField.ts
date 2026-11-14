import { createElement } from 'react';
import { z } from 'zod';
import type { BasicFormField } from '@keystatic/core';
import { Combobox, Item, type ComboboxProps } from '@keystar/ui/combobox';
import { MAKE_SLUGS, MAKES, type Make } from '../utils/makes';

const storedMake = z.enum(MAKE_SLUGS).nullable();

const option = (make: Make) =>
  createElement(Item, { key: make.slug, children: make.name });

const parse = (value: unknown): string | null =>
  storedMake.parse(value ?? null);

export const makeField = ({
  label,
}: {
  label: string;
}): BasicFormField<string | null> => ({
  kind: 'form',
  label,
  Input: ({ value, onChange, autoFocus }) =>
    createElement(Combobox<Make>, {
      label,
      value,
      onChange: (key) => onChange(key === null ? null : String(key)),
      autoFocus,
      defaultItems: MAKES,
      width: 'auto',
      children: option as unknown as ComboboxProps<Make>['children'],
    }),
  defaultValue: () => null,
  parse,
  serialize: (value) => ({ value: value ?? undefined }),
  validate: (value) => value,
  reader: { parse },
});
