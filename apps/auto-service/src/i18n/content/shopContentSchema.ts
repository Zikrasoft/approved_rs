import { z } from 'zod';
import {
  PRODUCT_TYPES,
  type Field,
  type ProductTypeDef,
  type Unit,
} from '@podbor/shop-catalog/browser';

export interface FieldCopy {
  label: string;
  values?: Record<string, string>;
}

export interface TypeCopy {
  name: string;
  heading: string;
  lead: string;
  metaTitle: string;
  metaDescription: string;
  landing: { heading: string; metaTitle: string; metaDescription: string };
  fields: Record<string, FieldCopy>;
}

const text = z.string();

const pluralSchema = z
  .object({
    one: text,
    few: text.optional(),
    many: text.optional(),
    other: text,
  })
  .strict();

const keyed = <T extends z.ZodType>(
  keys: readonly string[],
  value: (key: string) => T,
) =>
  z
    .object(
      Object.fromEntries(keys.map((key) => [key, value(key)])) as Record<
        string,
        T
      >,
    )
    .strict();

const fieldCopy = (field: Field): z.ZodType<FieldCopy> =>
  field.kind === 'enum'
    ? z
        .object({
          label: text,
          values: keyed(
            field.values.map((option) => option.value),
            () => text,
          ),
        })
        .strict()
    : z.object({ label: text }).strict();

const typeCopy = (type: ProductTypeDef): z.ZodType<TypeCopy> =>
  z
    .object({
      name: text,
      heading: text,
      lead: text,
      metaTitle: text,
      metaDescription: text,
      landing: z
        .object({ heading: text, metaTitle: text, metaDescription: text })
        .strict(),
      fields: keyed(
        type.fields.map((field) => field.key),
        (key) => fieldCopy(type.fields.find((field) => field.key === key)!),
      ),
    })
    .strict();

export const SHOP_UNITS: readonly Unit[] = [
  ...new Set(
    PRODUCT_TYPES.flatMap((type) =>
      type.fields.flatMap((field) =>
        field.kind === 'number' ? [field.unit] : [],
      ),
    ),
  ),
];

export const INSTALLATION_HANDLES: readonly string[] = [
  ...new Set(
    PRODUCT_TYPES.flatMap((type) =>
      type.installation ? [type.installation] : [],
    ),
  ),
];

export const shopContentSchema = z
  .object({
    metaTitle: text,
    metaDescription: text,
    eyebrow: text,
    heading: text,
    lead: text,
    fitmentHeading: text,
    makeLabel: text,
    modelLabel: text,
    yearLabel: text,
    anyOption: text,
    resetLabel: text,
    matchCount: pluralSchema,
    noMatches: text,
    noMatchesHint: text,
    emptyCatalog: text,
    capacityLabel: text,
    crankingLabel: text,
    polarityLabel: text,
    dimensionsLabel: text,
    dimensionsUnit: text,
    polarityLeft: text,
    polarityRight: text,
    warrantyLabel: text,
    warrantyUnit: text,
    fitsLabel: text,
    inStock: text,
    onOrder: text,
    addToCart: text,
    inCart: text,
    installNote: text,
    productMetaSuffix: text,
    typesHeading: text,
    productCount: pluralSchema,
    carLead: text,
    carClear: text,
    filterHeading: text,
    filterFrom: text,
    filterTo: text,
    booleanYes: text,
    booleanNo: text,
    allOfType: text,
    specsHeading: text,
    outOfStock: text,
    lowStock: text,
    goToCart: text,
    addError: text,
    soldOutError: text,
    previewHeading: text,
    previewBody: text,
    types: keyed(
      PRODUCT_TYPES.map((type) => type.key),
      (key) => typeCopy(PRODUCT_TYPES.find((type) => type.key === key)!),
    ),
    units: keyed(SHOP_UNITS, () => text),
    installations: keyed(INSTALLATION_HANDLES, () =>
      z.object({ name: text, note: text }).strict(),
    ),
    cart: z
      .object({
        metaTitle: text,
        metaDescription: text,
        eyebrow: text,
        heading: text,
        lead: text,
        empty: text,
        emptyCta: text,
        quantityLabel: text,
        removeLabel: text,
        totalLabel: text,
        totalNote: text,
        orderHeading: text,
        orderNote: text,
        badgeLabel: text,
        checkoutHeading: text,
        nameRequired: text,
        emailLabel: text,
        emailPlaceholder: text,
        errorEmail: text,
        errorName: text,
        submit: text,
        submitting: text,
        pickupHeading: text,
        pickupNote: text,
        successHeading: text,
        successBody: text,
        successCta: text,
        errors: z
          .object({
            stock: text,
            tooMany: text,
            network: text,
            invalid: text,
            changed: text,
            generic: text,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export type ShopContent = z.infer<typeof shopContentSchema>;
