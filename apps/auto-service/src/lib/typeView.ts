import {
  facetIndex,
  productType,
  type Facet,
  type FacetField,
  type FacetType,
  type Field,
  type FitmentRule,
  type ProductTypeDef,
  type Spec,
  type SpecValue,
} from '@podbor/shop-catalog/browser';
import { BCP47_BY_LOCALE, type Locale } from '@/i18n/config';
import { content } from '@/i18n/content';
import type { TypeCopy } from '@/i18n/content/shopContentSchema';

export interface SpecLine {
  key: string;
  label: string;
  value: string;
}

export interface TypeView {
  type: ProductTypeDef;
  copy: TypeCopy;
  field(key: string): Field;
  label(key: string): string;
  unit(key: string): string;
  optionLabel(key: string, value: string): string;
  formatValue(key: string, value: SpecValue): string;
  specLines(spec: Spec, scope?: 'card' | 'all'): SpecLine[];
  facets(specs: readonly Spec[], omit?: string): Facet[];
}

export interface FilterDef extends FacetType {
  fitment: FitmentRule;
}

const views = new WeakMap<ProductTypeDef, Map<Locale, TypeView>>();

function resolveType(typeOrKey: ProductTypeDef | string): ProductTypeDef {
  if (typeof typeOrKey !== 'string') return typeOrKey;
  const type = productType(typeOrKey);
  if (!type) throw new Error(`[shop] unknown product type "${typeOrKey}"`);
  return type;
}

function createView(type: ProductTypeDef, locale: Locale): TypeView {
  const shop = content(locale).shop;
  const copy = shop.types[type.key];
  const number = new Intl.NumberFormat(BCP47_BY_LOCALE[locale]);
  const fields = new Map(type.fields.map((field) => [field.key, field]));

  const field = (key: string): Field => {
    const found = fields.get(key);
    if (!found)
      throw new Error(
        `[shop] product type "${type.key}" has no field "${key}"`,
      );
    return found;
  };

  const optionLabel = (key: string, value: string): string => {
    const found = field(key);
    if (found.kind === 'enum') return copy.fields[key].values?.[value] ?? value;
    if (found.kind === 'boolean')
      return value === 'true' ? shop.booleanYes : shop.booleanNo;
    return value;
  };

  const unit = (key: string): string => {
    const found = field(key);
    return found.kind === 'number' ? shop.units[found.unit] : '';
  };

  const formatValue = (key: string, value: SpecValue): string => {
    if (field(key).kind === 'number')
      return `${number.format(Number(value))} ${unit(key)}`;
    if (Array.isArray(value)) return value.join(', ');
    return optionLabel(key, String(value));
  };

  return {
    type,
    copy,
    field,
    label: (key) => copy.fields[field(key).key].label,
    unit,
    optionLabel,
    formatValue,
    specLines: (spec, scope = 'all') =>
      type.fields.flatMap((entry) => {
        const value = spec[entry.key];
        if (value === undefined || (scope === 'card' && !entry.card)) return [];
        return [
          {
            key: entry.key,
            label: copy.fields[entry.key].label,
            value: formatValue(entry.key, value),
          },
        ];
      }),
    facets: (specs, omit) =>
      facetIndex(type, specs).filter((facet) => facet.key !== omit),
  };
}

export function typeView(
  typeOrKey: ProductTypeDef | string,
  locale: Locale,
): TypeView {
  const type = resolveType(typeOrKey);
  let byLocale = views.get(type);
  if (!byLocale) {
    byLocale = new Map();
    views.set(type, byLocale);
  }
  let view = byLocale.get(locale);
  if (!view) {
    view = createView(type, locale);
    byLocale.set(locale, view);
  }
  return view;
}

export function filterDef(type: ProductTypeDef): FilterDef {
  return {
    fitment: type.fitment,
    fields: type.fields.flatMap((field): FacetField[] => {
      if (!field.facet) return [];
      const { key } = field;
      return field.kind === 'enum'
        ? [
            {
              key,
              kind: field.kind,
              facet: true,
              values: field.values.map(({ value }) => ({ value })),
            },
          ]
        : [{ key, kind: field.kind, facet: true }];
    }),
  };
}
