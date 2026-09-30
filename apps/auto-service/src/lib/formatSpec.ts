import type {
  Field,
  ProductTypeDef,
  Spec,
  SpecValue,
} from '@podbor/shop-catalog/browser';
import type { ShopContent, TypeCopy } from '@/i18n/content/shopContentSchema';

export interface SpecCopy {
  type: TypeCopy;
  units: Record<string, string>;
  yes: string;
  no: string;
  bcp47: string;
}

export interface SpecLine {
  key: string;
  label: string;
  value: string;
}

export const specCopy = (
  shop: ShopContent,
  typeKey: string,
  bcp47: string,
): SpecCopy => ({
  type: shop.types[typeKey],
  units: shop.units,
  yes: shop.booleanYes,
  no: shop.booleanNo,
  bcp47,
});

export function optionLabel(
  field: Field,
  value: string,
  copy: SpecCopy,
): string {
  if (field.kind === 'enum')
    return copy.type.fields[field.key]?.values?.[value] ?? value;
  if (field.kind === 'boolean') return value === 'true' ? copy.yes : copy.no;
  return value;
}

export function formatValue(
  field: Field,
  value: SpecValue,
  copy: SpecCopy,
): string {
  if (field.kind === 'number')
    return `${new Intl.NumberFormat(copy.bcp47).format(Number(value))} ${copy.units[field.unit]}`;
  if (Array.isArray(value)) return value.join(', ');
  return optionLabel(field, String(value), copy);
}

export function formatSpec(
  type: ProductTypeDef,
  spec: Spec,
  copy: SpecCopy,
  scope: 'card' | 'all' = 'all',
): SpecLine[] {
  return type.fields.flatMap((field) => {
    const value = spec[field.key];
    if (value === undefined || (scope === 'card' && !field.card)) return [];
    return [
      {
        key: field.key,
        label: copy.type.fields[field.key].label,
        value: formatValue(field, value, copy),
      },
    ];
  });
}
